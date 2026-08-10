import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Explicit identity and no signing: the fixture commit must succeed on a machine with no
// git configuration at all, and must never touch the tester's global config.
const GIT_OPTIONS = [
  "-c",
  "user.name=Otomat Sandbox",
  "-c",
  "user.email=sandbox@otomat.local",
  "-c",
  "commit.gpgsign=false",
];

/**
 * Creates the sandbox fixture repository from the shipped template — a tiny dependency-free
 * Node project committed on `main`, so the daemon accepts it for registration and worktree
 * runs. Returns false when the repository already exists.
 */
export function ensureTestRepo(dir: string, templateDir: string): boolean {
  if (existsSync(join(dir, ".git"))) {
    if (hasCommit(dir)) return false;
    rmSync(dir, { recursive: true, force: true });
  }
  copyTemplate(templateDir, dir);
  git(dir, ["init", "-b", "main"]);
  git(dir, ["add", "."]);
  git(dir, ["commit", "-m", "Seed the sandbox repository"]);
  return true;
}

// A git hook exports GIT_DIR, GIT_INDEX_FILE and friends; inheriting them would aim these
// commands at the surrounding repository instead of the fixture. GIT_EXEC_PATH stays because
// git needs it to find its own subcommands.
function fixtureEnv(): NodeJS.ProcessEnv {
  const entries = Object.entries(process.env).filter(
    ([key]) => !key.startsWith("GIT_") || key === "GIT_EXEC_PATH",
  );
  return Object.fromEntries(entries);
}

// spawnSync, not execFileSync: a missing HEAD must read as false, not throw.
function hasCommit(dir: string): boolean {
  const probe = spawnSync("git", [...GIT_OPTIONS, "rev-parse", "--verify", "HEAD"], {
    cwd: dir,
    env: fixtureEnv(),
    stdio: "ignore",
  });
  return probe.status === 0;
}

// File-by-file because the template may live inside the app's asar archive, where Electron
// patches reads but not recursive copies.
function copyTemplate(from: string, to: string): void {
  mkdirSync(to, { recursive: true, mode: 0o700 });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const source = join(from, entry.name);
    const target = join(to, entry.name);
    if (entry.isDirectory()) copyTemplate(source, target);
    else writeFileSync(target, readFileSync(source));
  }
}

function git(cwd: string, args: string[]): void {
  execFileSync("git", [...GIT_OPTIONS, ...args], { cwd, env: fixtureEnv(), stdio: "pipe" });
}
