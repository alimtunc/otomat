// The staging directory lives OUTSIDE the workspace: an electron-builder run with a pnpm-lock
// ancestor triggers its dependency collector, which a pnpm monorepo cannot satisfy without devDeps.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assertMacHost, createBuildInfo, readProductVersion } from "./release/metadata.mjs";

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));

export const DESKTOP = join(HERE, "..");
export const REPO = join(DESKTOP, "..", "..");
export const RELEASE_OUT = join(DESKTOP, "release");

const WEB_DIST = join(REPO, "apps", "web", "dist");

function run(command, args, cwd = REPO) {
  console.log(`$ ${command} ${args.join(" ")}`);
  execFileSync(command, args, { cwd, stdio: "inherit" });
}

function git(args) {
  return execFileSync("git", args, { cwd: REPO, encoding: "utf8" }).trim();
}

/** The identity every artifact of this build carries: channel, version, commit, arch, Electron. */
export function resolveBuildInfo({ signed, channel, pr = null }) {
  return createBuildInfo({
    version: readProductVersion(join(DESKTOP, "package.json")),
    commit: git(["rev-parse", "HEAD"]),
    committedAt: git(["show", "-s", "--format=%cI", "HEAD"]),
    arch: process.arch,
    electronVersion: require("electron/package.json").version,
    signed,
    channel,
    pr,
  });
}

function buildInputs() {
  // CI packages from a fresh checkout and apps compile against package `dist`, so run the root
  // build first; `verifyDepsBeforeRun: warn` keeps `pnpm run` viable headless.
  run("pnpm", ["run", "build"]);
  run(process.execPath, [join(DESKTOP, "scripts", "prepare-daemon.mjs")], DESKTOP);

  for (const [label, path] of [
    ["desktop main", join(DESKTOP, "dist", "main", "index.js")],
    ["daemon entry", join(DESKTOP, ".daemon", "dist", "index.js")],
    ["web build", join(WEB_DIST, "index.html")],
  ]) {
    if (!existsSync(path)) throw new Error(`missing ${label} at ${path}`);
  }
}

function assembleStage(buildInfo, identity) {
  const stage = mkdtempSync(join(tmpdir(), "otomat-pack-"));
  cpSync(join(DESKTOP, "dist"), join(stage, "dist"), { recursive: true });
  cpSync(join(DESKTOP, "resources"), join(stage, "resources"), { recursive: true });
  cpSync(join(DESKTOP, "build"), join(stage, "build"), { recursive: true });
  cpSync(WEB_DIST, join(stage, "web"), { recursive: true });
  // Dereferenced because asar cannot ship symlinks; prepare-daemon's hoisted better-sqlite3 keeps
  // the flattened tree resolvable.
  cpSync(join(DESKTOP, ".daemon"), join(stage, "daemon"), { recursive: true, dereference: true });
  writeFileSync(join(stage, "build-info.json"), `${JSON.stringify(buildInfo, null, 2)}\n`);
  writeFileSync(
    join(stage, "package.json"),
    `${JSON.stringify(
      {
        name: "otomat-desktop",
        productName: identity.productName,
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

function builderConfig({ buildInfo, signing, identity }) {
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
    appId: identity.appId,
    productName: identity.productName,
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

function locateArtifacts(productName) {
  const entries = readdirSync(RELEASE_OUT);
  const appDir = entries.find((entry) =>
    existsSync(join(RELEASE_OUT, entry, `${productName}.app`)),
  );
  if (appDir === undefined) throw new Error(`no ${productName}.app under ${RELEASE_OUT}`);
  // The output directory is rebuilt every run, so its single DMG is this build's, whatever
  // electron-builder decided to call a product name containing spaces.
  const dmgs = entries.filter((entry) => entry.endsWith(".dmg"));
  if (dmgs.length !== 1) {
    throw new Error(`expected exactly one DMG in ${RELEASE_OUT}, found ${String(dmgs.length)}`);
  }
  return {
    appPath: join(RELEASE_OUT, appDir, `${productName}.app`),
    dmgPath: join(RELEASE_OUT, dmgs[0]),
  };
}

/**
 * @param {{ buildInfo: object, signing: { teamId: string } | null,
 *   identity: { pr: number | null, productName: string, appId: string } }} input
 * @returns {{ appPath: string, dmgPath: string, releaseDir: string }}
 */
export function buildMacApp(input) {
  assertMacHost(process.platform);
  const { identity } = input;
  buildInputs();
  const stage = assembleStage(input.buildInfo, identity);

  try {
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
  }

  // The same metadata the app ships, next to the artifacts: the smoke and CI read the channel and
  // the commit of a build without having to open its asar.
  writeFileSync(
    join(RELEASE_OUT, "build-info.json"),
    `${JSON.stringify(input.buildInfo, null, 2)}\n`,
  );

  return { ...locateArtifacts(identity.productName), releaseDir: RELEASE_OUT };
}
