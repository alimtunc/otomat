// The staging directory lives OUTSIDE the workspace: an electron-builder run with a pnpm-lock
// ancestor triggers its dependency collector, which a pnpm monorepo cannot satisfy without devDeps.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { APP_ID, createBuildInfo, readProductVersion } from "./release/metadata.mjs";

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));

export const DESKTOP = join(HERE, "..");
export const REPO = join(DESKTOP, "..", "..");
export const RELEASE_OUT = join(DESKTOP, "release");
export const PRODUCT_NAME = "Otomat";

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
  // Invoked directly, not through `pnpm run`, whose verify-deps pre-check is headless-incompatible.
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
  // Dereferenced because asar cannot ship symlinks; prepare-daemon's hoisted closure keeps the
  // flattened tree resolvable.
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
          // `mac.notarize` is a boolean in electron-builder 26; the credentials come from the
          // APPLE_API_* environment it reads directly.
          notarize: true,
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
  // pnpm hardlinks the store copy, so the Electron rebuild below reaches it too and would leave the
  // daemon unloadable under system Node. `pnpm rebuild` no-ops once a build exists, hence gyp.
  console.log("Restoring the workspace better-sqlite3 to the system-Node ABI…");
  const packageDir = storePkgDir("better-sqlite3");
  // @electron/rebuild keeps its Electron-ABI build here and restores it over a later rebuild.
  rmSync(join(packageDir, "bin"), { recursive: true, force: true });
  run("npm", ["run", "build-release"], packageDir);
  // A silent failure here leaves `pnpm check` broken long after the build, so prove it loaded.
  run(
    process.execPath,
    ["-e", "require(process.argv[1])", join(packageDir, "build/Release/better_sqlite3.node")],
    packageDir,
  );
}

/**
 * @param {{ buildInfo: object, signing: { teamId: string } | null }} input
 * @returns {{ appPath: string, dmgPath: string, releaseDir: string }}
 */
export function buildMacApp(input) {
  buildInputs();
  const stage = assembleStage(input.buildInfo);

  // cwd must be inside the stage: electron-rebuild resolves better-sqlite3 from it, and anywhere
  // else would retarget the workspace copy to Electron's ABI.
  console.log(`Rebuilding better-sqlite3 for Electron ${input.buildInfo.electron}…`);
  try {
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
    run(
      process.execPath,
      [builderCli, "--mac", "--projectDir", stage, "--publish", "never"],
      stage,
    );
  } finally {
    rmSync(stage, { recursive: true, force: true });
    healWorkspaceNativeAbi();
  }

  return {
    ...locateArtifacts(input.buildInfo.version, input.buildInfo.arch),
    releaseDir: RELEASE_OUT,
  };
}
