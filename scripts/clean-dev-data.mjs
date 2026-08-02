#!/usr/bin/env node
/**
 * Wipes this checkout's Otomat dev data so the next launch starts from a blank
 * slate: the desktop dev data root (SQLite database, run artifacts, generated
 * worktrees, execution-hosts config, Linear vault) and the daemon-only `.data/`
 * directory. Optionally also resets a remote host over SSH and prunes the run
 * worktrees/branches Otomat left in registered repositories.
 *
 *   pnpm clean:data                       # local dev data of this worktree
 *   pnpm clean:data --vps otomat-vps      # + stop the remote daemon and wipe ~/.otomat data
 *   pnpm clean:data --repo ~/repos/scratch  # + prune otomat/run/* leftovers in a repo
 *   pnpm clean:data --dry-run             # print what would be removed
 *
 * Quit the desktop app first: a running instance holds the database open and
 * would recreate state mid-wipe. The remote daemon deploy (~/.otomat/daemon) is
 * never touched — only its data.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, realpathSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(fileURLToPath(new URL(".", import.meta.url)));

function appDataDir() {
  if (process.platform === "darwin") return join(homedir(), "Library", "Application Support");
  if (process.platform === "win32" && process.env.APPDATA) return process.env.APPDATA;
  return process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
}

/** Mirrors apps/desktop/src/main/dev-data-root.ts so the wipe hits the exact per-worktree root. */
function devDataRoot() {
  const override = process.env.OTOMAT_DESKTOP_DEV_DATA_ROOT?.trim() ?? "";
  if (override !== "") return resolve(override);
  const worktree = realpathSync.native(resolve(repoRoot));
  const digest = createHash("sha256").update(worktree).digest("hex").slice(0, 12);
  const name =
    basename(worktree)
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "worktree";
  return join(appDataDir(), "Otomat Dev", `${name}-${digest}`);
}

function parseArgs(argv) {
  const options = { vps: null, repos: [], dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--dry-run") options.dryRun = true;
    else if (flag === "--vps") options.vps = argv[++index] ?? null;
    else if (flag === "--repo") options.repos.push(argv[++index] ?? "");
    else {
      console.error(`Unknown argument: ${flag}`);
      process.exit(2);
    }
  }
  if (options.vps !== null && (/\s/.test(options.vps) || options.vps.startsWith("-"))) {
    console.error("--vps expects a single-word ~/.ssh/config alias.");
    process.exit(2);
  }
  if (options.repos.some((repo) => repo === "")) {
    console.error("--repo expects a path.");
    process.exit(2);
  }
  return options;
}

function removeLocal(path, dryRun) {
  if (!existsSync(path)) {
    console.log(`  absent   ${path}`);
    return;
  }
  if (dryRun) {
    console.log(`  would rm ${path}`);
    return;
  }
  rmSync(path, { recursive: true, force: true });
  console.log(`  removed  ${path}`);
}

function run(command, args, dryRun) {
  console.log(`  ${dryRun ? "would run" : "$"} ${command} ${args.join(" ")}`);
  if (dryRun) return true;
  const result = spawnSync(command, args, { stdio: "inherit" });
  return result.status === 0;
}

const REMOTE_RESET =
  'pkill -f "daemon/dist/index.js" 2>/dev/null; sleep 1; ' +
  "rm -rf ~/.otomat/data ~/.otomat/daemon.pid ~/.otomat/daemon.log; " +
  'echo "remote data reset (deploy kept)"';

function cleanRepo(repoPath, dryRun) {
  const repo = resolve(repoPath.replace(/^~(?=\/|$)/, homedir()));
  console.log(`Repository ${repo}:`);
  if (!existsSync(join(repo, ".git"))) {
    console.error("  not a git repository, skipped");
    return false;
  }
  if (!run("git", ["-C", repo, "worktree", "prune"], dryRun)) return false;
  const branches = spawnSync(
    "git",
    ["-C", repo, "branch", "--list", "otomat/run/*", "--format=%(refname:short)"],
    { encoding: "utf8" },
  )
    .stdout.split("\n")
    .filter(Boolean);
  if (branches.length === 0) {
    console.log("  no otomat/run/* branches");
    return true;
  }
  return run("git", ["-C", repo, "branch", "-D", ...branches], dryRun);
}

const options = parseArgs(process.argv.slice(2));
let ok = true;

console.log("Local dev data (quit the desktop app first):");
removeLocal(devDataRoot(), options.dryRun);
removeLocal(join(repoRoot, ".data"), options.dryRun);

if (options.vps !== null) {
  console.log(`Remote host ${options.vps}:`);
  ok = run("ssh", ["-o", "BatchMode=yes", options.vps, REMOTE_RESET], options.dryRun) && ok;
}

for (const repo of options.repos) ok = cleanRepo(repo, options.dryRun) && ok;

if (!ok) process.exit(1);
console.log(
  options.dryRun
    ? "Dry run — nothing was removed."
    : "Done. Next launch starts from a blank slate.",
);
