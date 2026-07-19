// Prepares the daemon for packaging into `.daemon`:
//  1. build the daemon (normal dist — deps stay external);
//  2. `pnpm deploy` a self-contained copy (all workspace + npm deps) into `.daemon`;
//  3. hoist better-sqlite3's native closure to the TOP-LEVEL node_modules — pnpm co-locates it
//     under a private `.pnpm` dir that survives symlinks but NOT the symlink-flattening the app
//     bundle needs, so `@otomat/db`'s `import "better-sqlite3"` would otherwise be unresolvable.
// package-mac.mjs dereferences `.daemon` into real files (asar cannot ship the pnpm symlink farm)
// and rebuilds better-sqlite3 for Electron's ABI on that ephemeral copy — never here, so the
// shared pnpm store (hardlinked into `.daemon`) is never mutated to Electron's ABI.
//
// Build tools are invoked directly (never `pnpm run`, whose verify-deps pre-check runs a
// headless-incompatible `install --production`). `pnpm deploy` is not a `pnpm run`; CI=true only
// skips its interactive modules-purge confirmation for the staging dir it creates.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DESKTOP_DIR = join(HERE, "..");
const REPO_ROOT = join(DESKTOP_DIR, "..", "..");
const DAEMON_DIR = join(REPO_ROOT, "apps", "local-daemon");
const PNPM_STORE = join(REPO_ROOT, "node_modules", ".pnpm");
const STAGE = join(DESKTOP_DIR, ".daemon");

/** Real package dir in the pnpm store for `name` (e.g. .pnpm/better-sqlite3@X/node_modules/better-sqlite3). */
function storePkgDir(name) {
  const prefix = `${name.replace(/\//g, "+")}@`;
  const entry = readdirSync(PNPM_STORE).find((dir) => dir.startsWith(prefix));
  if (entry === undefined) throw new Error(`cannot find ${name} in the pnpm store`);
  return join(PNPM_STORE, entry, "node_modules", name);
}

// 1. Build the daemon (direct tsdown, not `pnpm run`).
execFileSync(join(DAEMON_DIR, "node_modules", ".bin", "tsdown"), [], {
  cwd: DAEMON_DIR,
  stdio: "inherit",
});

// 2. Deploy a self-contained daemon into .daemon.
rmSync(STAGE, { recursive: true, force: true });
execFileSync("pnpm", ["--filter", "@otomat/local-daemon", "deploy", "--prod", "--legacy", STAGE], {
  cwd: REPO_ROOT,
  stdio: "inherit",
  env: { ...process.env, CI: "true" },
});
if (!existsSync(join(STAGE, "dist", "index.js"))) {
  throw new Error(`daemon deploy missing dist/index.js at ${STAGE}`);
}

// 3. Hoist better-sqlite3's runtime closure to the top level so it resolves after flattening.
for (const dep of ["better-sqlite3", "bindings", "file-uri-to-path"]) {
  cpSync(storePkgDir(dep), join(STAGE, "node_modules", dep), {
    recursive: true,
    dereference: true,
  });
}

console.log(`Daemon prepared at ${STAGE}`);
