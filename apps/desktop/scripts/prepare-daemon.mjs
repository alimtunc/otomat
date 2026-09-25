// Prepares the daemon for packaging into `.daemon`:
//  1. build the daemon (normal dist — deps stay external);
//  2. `pnpm deploy` a self-contained copy (all workspace + npm deps) into `.daemon`;
//  3. strip better-sqlite3 down to the prebuilt binary this host loads;
//  4. hoist it to the TOP-LEVEL node_modules — pnpm co-locates it under a private `.pnpm` dir that
//     survives symlinks but NOT the symlink-flattening the app bundle needs, so `@otomat/db`'s
//     `import "better-sqlite3"` would otherwise be unresolvable.
// mac-build.mjs dereferences `.daemon` when staging (asar cannot ship the pnpm symlink farm).
//
// CI=true on `pnpm deploy` only skips its interactive modules-purge confirmation for the staging
// dir it creates.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DESKTOP_DIR = join(HERE, "..");
const REPO_ROOT = join(DESKTOP_DIR, "..", "..");
const STAGE = join(DESKTOP_DIR, ".daemon");
// The deploy's store, never the workspace's — that one keeps stale majors a prefix match can pick.
const DEPLOYED_STORE = join(STAGE, "node_modules", ".pnpm");

// 1. Build the daemon and the workspace deps the deploy packs from their `dist`, so a standalone
// invocation never deploys a stale one.
execFileSync("pnpm", ["--filter", "@otomat/local-daemon...", "run", "build"], {
  cwd: REPO_ROOT,
  stdio: "inherit",
});

// 2. Deploy a self-contained daemon into .daemon. The web-only patch is unused here; pnpm 12
// refuses an unused patch unless told otherwise.
rmSync(STAGE, { recursive: true, force: true });
execFileSync(
  "pnpm",
  [
    "--filter",
    "@otomat/local-daemon",
    "deploy",
    "--prod",
    "--legacy",
    "--config.allow-unused-patches=true",
    STAGE,
  ],
  {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: { ...process.env, CI: "true" },
  },
);
if (!existsSync(join(STAGE, "dist", "index.js"))) {
  throw new Error(`daemon deploy missing dist/index.js at ${STAGE}`);
}

// 3. Keep only the prebuilt binary this host loads. Prune before the hoist: packaging copies and
// signs this whole tree, so a foreign binary left here still ships.
const sqliteStoreDirs = readdirSync(DEPLOYED_STORE).filter((dir) =>
  dir.startsWith("better-sqlite3@"),
);
if (sqliteStoreDirs.length !== 1) {
  throw new Error(
    `expected exactly one better-sqlite3 in ${DEPLOYED_STORE}, found ${sqliteStoreDirs.length === 0 ? "none" : sqliteStoreDirs.join(", ")}`,
  );
}
const sqliteDir = join(DEPLOYED_STORE, sqliteStoreDirs[0], "node_modules", "better-sqlite3");
const prebuilds = join(sqliteDir, "prebuilds");
const hostBinary = `${process.platform}-${process.arch}.node`;
if (!existsSync(join(prebuilds, hostBinary))) {
  throw new Error(`${sqliteDir} ships no prebuilt binary for ${hostBinary}`);
}
for (const file of readdirSync(prebuilds)) {
  if (file !== hostBinary) rmSync(join(prebuilds, file));
}

// 4. Hoist better-sqlite3 (dependency-free since v13) to the top level so it resolves after
// flattening.
cpSync(sqliteDir, join(STAGE, "node_modules", "better-sqlite3"), {
  recursive: true,
  dereference: true,
});

const ptyDirs = readdirSync(DEPLOYED_STORE).filter((dir) => dir.startsWith("node-pty@"));
if (ptyDirs.length !== 1) throw new Error("Expected one deployed node-pty package.");
const ptyDir = join(DEPLOYED_STORE, ptyDirs[0], "node_modules", "node-pty");
const ptyPlatform = `${process.platform}-${process.arch}`;
const ptyBinary = join(ptyDir, "prebuilds", ptyPlatform, "pty.node");
if (process.platform === "linux" && !existsSync(ptyBinary)) {
  mkdirSync(join(ptyDir, "prebuilds", ptyPlatform), { recursive: true });
  cpSync(join(ptyDir, "build", "Release", "pty.node"), ptyBinary);
}
if (!existsSync(ptyBinary)) {
  throw new Error(`node-pty has no native prebuild for ${ptyPlatform}`);
}
if (
  process.platform === "darwin" &&
  !existsSync(join(ptyDir, "prebuilds", ptyPlatform, "spawn-helper"))
) {
  throw new Error("node-pty has no macOS spawn helper.");
}
for (const dir of readdirSync(join(ptyDir, "prebuilds"))) {
  if (dir !== ptyPlatform) rmSync(join(ptyDir, "prebuilds", dir), { recursive: true });
}
rmSync(join(ptyDir, "build"), { recursive: true, force: true });
rmSync(join(ptyDir, "third_party"), { recursive: true, force: true });
rmSync(join(STAGE, "node_modules", "node-pty"), { recursive: true, force: true });
cpSync(ptyDir, join(STAGE, "node_modules", "node-pty"), { recursive: true, dereference: true });

console.log(`Daemon prepared at ${STAGE}`);
