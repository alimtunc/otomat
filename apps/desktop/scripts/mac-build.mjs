// Builds the macOS .app/.dmg. electron-builder v26 runs its dependency collector via the workspace
// package manager (`pnpm install --production`), which a pnpm monorepo cannot satisfy without
// purging devDeps. To avoid that, we assemble a self-contained staging directory OUTSIDE the
// workspace (no pnpm-lock ancestor → no collector) and point electron-builder there.
//
// One builder, two states: without `signing` it emits the ad-hoc signed local artifact, with it the
// Developer ID signed and notarized one. `package-mac.mjs` and `release-mac.mjs` are the entries.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createBuildInfo, readProductVersion } from "./release/metadata.mjs";

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));

export const DESKTOP = join(HERE, "..");
export const REPO = join(DESKTOP, "..", "..");
export const RELEASE_OUT = join(DESKTOP, "release");
export const PRODUCT_NAME = "Otomat";
export const APP_ID = "com.otomat.desktop";

const WEB_DIR = join(REPO, "apps", "web");
const WEB_DIST = join(WEB_DIR, "dist");
const PNPM_STORE = join(REPO, "node_modules", ".pnpm");

function run(command, args, cwd = REPO) {
  console.log(`$ ${command} ${args.join(" ")}`);
  execFileSync(command, args, { cwd, stdio: "inherit" });
}

/** Real package dir in the pnpm store for `name`. */
function storePkgDir(name) {
  const prefix = `${name.replace(/\//g, "+")}@`;
  const entry = readdirSync(PNPM_STORE).find((dir) => dir.startsWith(prefix));
  if (entry === undefined) throw new Error(`cannot find ${name} in the pnpm store`);
  return join(PNPM_STORE, entry, "node_modules", name);
}

function git(args) {
  return execFileSync("git", args, { cwd: REPO, encoding: "utf8" }).trim();
}

/** The identity every artifact of this build carries: version, commit, architecture, Electron. */
export function resolveBuildInfo({ signed }) {
  return createBuildInfo({
    version: readProductVersion(join(DESKTOP, "package.json")),
    commit: git(["rev-parse", "HEAD"]),
    committedAt: git(["show", "-s", "--format=%cI", "HEAD"]),
    arch: process.arch,
    electronVersion: require("electron/package.json").version,
    signed,
  });
}

function buildInputs() {
  // Build the inputs directly (not via `pnpm run`, whose verify-deps pre-check runs a
  // headless-incompatible `install --production`). Renderer = vite build; main/preload = tsdown;
  // daemon = prepare-daemon.mjs (build + deploy + hoist native closure; rebuilt for Electron below).
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
}

function assembleStage(buildInfo) {
  const stage = mkdtempSync(join(tmpdir(), "otomat-pack-"));
  cpSync(join(DESKTOP, "dist"), join(stage, "dist"), { recursive: true });
  cpSync(join(DESKTOP, "resources"), join(stage, "resources"), { recursive: true });
  cpSync(join(DESKTOP, "build"), join(stage, "build"), { recursive: true });
  cpSync(WEB_DIST, join(stage, "web"), { recursive: true });
  // Flatten the deployed daemon's pnpm symlink farm into real files — asar cannot ship symlinks,
  // and the hoisted better-sqlite3 closure (added by prepare-daemon) makes the flat tree resolve.
  cpSync(join(DESKTOP, ".daemon"), join(stage, "daemon"), { recursive: true, dereference: true });
  writeFileSync(join(stage, "build-info.json"), `${JSON.stringify(buildInfo, null, 2)}\n`);
  writeFileSync(
    join(stage, "package.json"),
    `${JSON.stringify(
      {
        name: "otomat-desktop",
        productName: PRODUCT_NAME,
        version: buildInfo.version,
        main: "dist/main/index.js",
        private: true,
      },
      null,
      2,
    )}\n`,
  );
  return stage;
}

function builderConfig({ buildInfo, signing }) {
  const mac =
    signing === null
      ? { identity: null, hardenedRuntime: false }
      : {
          hardenedRuntime: true,
          entitlements: "build/entitlements.mac.plist",
          entitlementsInherit: "build/entitlements.mac.plist",
          notarize: { teamId: signing.teamId },
        };
  return {
    appId: APP_ID,
    productName: PRODUCT_NAME,
    copyright: `Copyright © ${buildInfo.committed_at.slice(0, 4)} Otomat`,
    electronVersion: buildInfo.electron,
    npmRebuild: false,
    asar: true,
    publish: null,
    artifactName: "${productName}-${version}-${arch}.${ext}",
    afterPack: "build/afterpack.cjs",
    directories: { output: RELEASE_OUT, buildResources: "build" },
    files: ["dist/**/*", "resources/**/*", "package.json", "build-info.json", "daemon/**/*"],
    asarUnpack: ["daemon/**"],
    extraResources: [{ from: "web", to: "web" }],
    mac: {
      target: [
        { target: "dir", arch: [buildInfo.arch] },
        { target: "dmg", arch: [buildInfo.arch] },
      ],
      category: "public.app-category.developer-tools",
      icon: "build/icon.png",
      gatekeeperAssess: false,
      ...mac,
    },
  };
}

function locateArtifacts(version, arch) {
  const appDir = readdirSync(RELEASE_OUT).find((entry) =>
    existsSync(join(RELEASE_OUT, entry, `${PRODUCT_NAME}.app`)),
  );
  if (appDir === undefined) throw new Error(`no ${PRODUCT_NAME}.app under ${RELEASE_OUT}`);
  const dmgPath = join(RELEASE_OUT, `${PRODUCT_NAME}-${version}-${arch}.dmg`);
  if (!existsSync(dmgPath)) throw new Error(`no DMG at ${dmgPath}`);
  return { appPath: join(RELEASE_OUT, appDir, `${PRODUCT_NAME}.app`), dmgPath };
}

function healWorkspaceNativeAbi() {
  // The Electron rebuild above, despite targeting the stage, also rebuilds the shared pnpm-store
  // copy (pnpm hardlinks + how @electron/rebuild resolves the module), which would otherwise break
  // the daemon under `pnpm back`. The artifact already carries the Electron-ABI binding, so this
  // only heals the dev workspace. `pnpm rebuild` is a no-op once a build exists, so recompile via
  // the package's own gyp script.
  console.log("Restoring the workspace better-sqlite3 to the system-Node ABI…");
  run("npm", ["run", "build-release"], storePkgDir("better-sqlite3"));
}

/**
 * @param {{ buildInfo: object, signing: { teamId: string } | null }} input
 * @returns {{ appPath: string, dmgPath: string, releaseDir: string }}
 */
export function buildMacApp(input) {
  buildInputs();
  const stage = assembleStage(input.buildInfo);

  // Rebuild better-sqlite3 for Electron's ABI on the STAGING copy only. Run the electron-rebuild
  // CLI with cwd INSIDE the stage (in /tmp) — its programmatic API resolves better-sqlite3 relative
  // to the process cwd and would otherwise rebuild the workspace's shared pnpm store to Electron's
  // ABI, breaking the daemon under system Node.
  console.log(`Rebuilding better-sqlite3 for Electron ${input.buildInfo.electron}…`);
  run(
    join(DESKTOP, "node_modules", ".bin", "electron-rebuild"),
    [
      "--version",
      input.buildInfo.electron,
      "--arch",
      input.buildInfo.arch,
      "--module-dir",
      ".",
      "--only",
      "better-sqlite3",
      "--force",
    ],
    join(stage, "daemon"),
  );

  writeFileSync(
    join(stage, "electron-builder.json"),
    `${JSON.stringify(builderConfig(input), null, 2)}\n`,
  );

  rmSync(RELEASE_OUT, { recursive: true, force: true });
  const builderCli = require.resolve("electron-builder/cli.js");
  run(process.execPath, [builderCli, "--mac", "--projectDir", stage, "--publish", "never"], stage);
  rmSync(stage, { recursive: true, force: true });
  healWorkspaceNativeAbi();

  return {
    ...locateArtifacts(input.buildInfo.version, input.buildInfo.arch),
    releaseDir: RELEASE_OUT,
  };
}
