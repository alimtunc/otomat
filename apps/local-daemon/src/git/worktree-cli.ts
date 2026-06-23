import { runGit } from "./git-cli.js";

export interface AddWorktreeInput {
  worktreePath: string;
  branch: string;
  baseRef: string;
}

/** `git worktree add -b <branch> <path> <baseRef>` — creates the branch and checkout. */
export function addWorktree(repoPath: string, input: AddWorktreeInput): void {
  runGit(["worktree", "add", "-b", input.branch, input.worktreePath, input.baseRef], {
    cwd: repoPath,
  });
}

/**
 * Removes a worktree's working directory and admin files. Tolerant of an
 * already-removed directory so callers can converge a half-removed state.
 */
export function removeWorktree(repoPath: string, worktreePath: string): void {
  runGit(["worktree", "remove", "--force", worktreePath], { cwd: repoPath, allowFailure: true });
}

/** Prunes stale `.git/worktrees/<name>` admin entries with no working directory. */
export function pruneWorktrees(repoPath: string): void {
  runGit(["worktree", "prune"], { cwd: repoPath });
}

export interface GitWorktreeEntry {
  path: string;
  head: string | null;
  /** Short branch name (`refs/heads/` stripped), or `null` when detached/bare. */
  branch: string | null;
  bare: boolean;
  detached: boolean;
}

/** Parses `git worktree list --porcelain` into structured entries. */
export function listWorktrees(repoPath: string): GitWorktreeEntry[] {
  const out = runGit(["worktree", "list", "--porcelain"], { cwd: repoPath }).stdout;
  return parseWorktreeList(out);
}

export function parseWorktreeList(porcelain: string): GitWorktreeEntry[] {
  const entries: GitWorktreeEntry[] = [];
  let current: GitWorktreeEntry | null = null;

  for (const line of porcelain.split("\n")) {
    if (line === "") {
      if (current) entries.push(current);
      current = null;
      continue;
    }
    if (line.startsWith("worktree ")) {
      current = {
        path: line.slice("worktree ".length),
        head: null,
        branch: null,
        bare: false,
        detached: false,
      };
    } else if (!current) {
      continue;
    } else if (line.startsWith("HEAD ")) {
      current.head = line.slice("HEAD ".length);
    } else if (line.startsWith("branch ")) {
      current.branch = line.slice("branch ".length).replace(/^refs\/heads\//, "");
    } else if (line === "bare") {
      current.bare = true;
    } else if (line === "detached") {
      current.detached = true;
    }
  }
  if (current) entries.push(current);
  return entries;
}
