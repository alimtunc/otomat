// Builds the unsigned macOS .app/.dmg. electron-builder v26 runs its dependency collector via
// the workspace package manager (`pnpm install --production`), which a pnpm monorepo cannot
// satisfy without purging devDeps. To avoid that, we assemble a self-contained staging directory
// OUTSIDE the workspace (no pnpm-lock ancestor → no collector) and point electron-builder there.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const DESKTOP = join(HERE, "..");
const REPO = join(DESKTOP, "..", "..");
const WEB_DIR = join(REPO, "apps", "web");
const WEB_DIST = join(WEB_DIR, "dist");
const RELEASE_OUT = join(DESKTOP, "release");
const PNPM_STORE = join(REPO, "node_modules", ".pnpm");

function run(cmd, args, cwd = REPO) {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { cwd, stdio: "inherit" });
}

/** Real package dir in the pnpm store for `name`. */
function storePkgDir(name) {
  const prefix = `${name.replace(/\//g, "+")}@`;
  const entry = readdirSync(PNPM_STORE).find((dir) => dir.startsWith(prefix));
  if (entry === undefined) throw new Error(`cannot find ${name} in the pnpm store`);
  return join(PNPM_STORE, entry, "node_modules", name);
}

// 1. Build the inputs directly (not via `pnpm run`, whose verify-deps pre-check runs a
//    headless-incompatible `install --production`). Renderer = vite build; main/preload = tsdown;
//    daemon = prepare-daemon.mjs (build + deploy + hoist native closure; rebuilt for Electron below).
run(join(WEB_DIR, "node_modules", ".bin", "vite"), ["build"], WEB_DIR);
run(join(DESKTOP, "node_modules", ".bin", "tsdown"), [], DESKTOP);
run(process.execPath, [join(DESKTOP, "scripts", "prepare-daemon.mjs")], DESKTOP);

for (const [label, path] of [
  ["desktop main", join(DESKTOP, "dist", "main", "index.js")],
  ["daemon entry", join(DESKTOP, ".daemon", "dist", "index.js")],
  ["web build", join(WEB_DIST, "index.html")],
]) {
  if (!existsSync(path)) throw new Error(`missing ${label} at ${path}`);
}

// 2. Assemble a workspace-free staging dir (symlinks dereferenced into real files).
const stage = mkdtempSync(join(tmpdir(), "otomat-pack-"));
cpSync(join(DESKTOP, "dist"), join(stage, "dist"), { recursive: true });
cpSync(join(DESKTOP, "resources"), join(stage, "resources"), { recursive: true });
cpSync(WEB_DIST, join(stage, "web"), { recursive: true });
// Flatten the deployed daemon's pnpm symlink farm into real files — asar cannot ship symlinks,
// and the hoisted better-sqlite3 closure (added by prepare-daemon) makes the flat tree resolve.
cpSync(join(DESKTOP, ".daemon"), join(stage, "daemon"), { recursive: true, dereference: true });

// Rebuild better-sqlite3 for Electron's ABI on the STAGING copy only. Run the electron-rebuild
// CLI with cwd INSIDE the stage (in /tmp) — its programmatic API resolves better-sqlite3 relative
// to the process cwd and would otherwise rebuild the workspace's shared pnpm store to Electron's
// ABI, breaking the daemon under system Node.
const electronVersion = require("electron/package.json").version;
console.log(`Rebuilding better-sqlite3 for Electron ${electronVersion}…`);
run(
  join(DESKTOP, "node_modules", ".bin", "electron-rebuild"),
  ["--version", electronVersion, "--module-dir", ".", "--only", "better-sqlite3", "--force"],
  join(stage, "daemon"),
);

// Ad-hoc sign the .app before the DMG is built: on Apple Silicon an unsigned app cannot load
// its own Electron Framework (dyld refuses). Ad-hoc (`-`) means no Developer ID / notarization —
// still "unsigned" for distribution, but executable locally after a right-click → Open.
writeFileSync(
  join(stage, "afterpack.cjs"),
  [
    'const { execFileSync } = require("node:child_process");',
    'const { join } = require("node:path");',
    "exports.default = async function adhocSign(context) {",
    '  if (context.electronPlatformName !== "darwin") return;',
    "  const app = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);",
    '  execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], { stdio: "inherit" });',
    "};",
    "",
  ].join("\n"),
);

writeFileSync(
  join(stage, "package.json"),
  `${JSON.stringify(
    {
      name: "otomat-desktop",
      productName: "Otomat",
      version: "0.0.0",
      main: "dist/main/index.js",
      private: true,
    },
    null,
    2,
  )}\n`,
);
writeFileSync(
  join(stage, "electron-builder.yml"),
  [
    "appId: com.otomat.desktop",
    "productName: Otomat",
    `electronVersion: ${electronVersion}`,
    "npmRebuild: false",
    "asar: true",
    "afterPack: ./afterpack.cjs",
    "directories:",
    // Write straight into the repo (gitignored) so the app bundle's symlinks are never copied/mangled.
    `  output: ${RELEASE_OUT}`,
    "files:",
    '  - "dist/**/*"',
    '  - "resources/**/*"',
    '  - "package.json"',
    '  - "daemon/**/*"',
    "asarUnpack:",
    '  - "daemon/**"',
    "extraResources:",
    '  - from: "web"',
    '    to: "web"',
    "mac:",
    "  target:",
    "    - target: dir",
    "    - target: dmg",
    "  category: public.app-category.developer-tools",
    "  identity: null",
    "  hardenedRuntime: false",
    "  gatekeeperAssess: false",
    "",
  ].join("\n"),
);

// 3. Run electron-builder against the staging dir (it writes directly to RELEASE_OUT). Resolve
//    its CLI so we invoke the exact workspace-installed binary on a project with no workspace ancestor.
rmSync(RELEASE_OUT, { recursive: true, force: true });
const builderCli = require.resolve("electron-builder/cli.js");
run(process.execPath, [builderCli, "--mac", "--projectDir", stage, "--publish", "never"], stage);

rmSync(stage, { recursive: true, force: true });

// Restore the workspace's better-sqlite3 to the system-Node ABI. The Electron rebuild above,
// despite targeting the stage, also rebuilds the shared pnpm-store copy (pnpm hardlinks + how
// @electron/rebuild resolves the module), which would otherwise break the daemon under `pnpm back`.
// The artifact is already built with the Electron-ABI binding, so this only heals the dev workspace.
// `pnpm rebuild` is a no-op once a build exists, so recompile via the package's own gyp script.
console.log("Restoring the workspace better-sqlite3 to the system-Node ABI…");
run("npm", ["run", "build-release"], storePkgDir("better-sqlite3"));

console.log(`\nArtifact written to ${RELEASE_OUT}`);
