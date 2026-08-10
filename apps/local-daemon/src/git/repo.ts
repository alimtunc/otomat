import { runGit } from "./git-cli.js";
import { tryRealpath } from "./probe.js";

/** Resolves a ref (branch, tag, sha, `<ref>^{tree}`, ...) to its object id. */
export function revParse(repoPath: string, ref: string): string {
  return runGit(["rev-parse", ref], { cwd: repoPath }).stdout.trim();
}

/** Current `HEAD` commit sha of the repo or worktree at `repoPath`. */
export function headSha(repoPath: string): string {
  return revParse(repoPath, "HEAD");
}

/** Short symbolic name of the checked-out branch (e.g. `main`). */
function currentBranch(repoPath: string): string {
  return runGit(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repoPath }).stdout.trim();
}

/** Best common ancestor of two refs, or `null` when histories are unrelated. */
export function mergeBase(repoPath: string, a: string, b: string): string | null {
  const res = runGit(["merge-base", a, b], { cwd: repoPath, allowFailure: true });
  if (res.exitCode !== 0) return null;
  const sha = res.stdout.trim();
  return sha === "" ? null : sha;
}

export function isAncestor(repoPath: string, ancestor: string, descendant: string): boolean {
  return (
    runGit(["merge-base", "--is-ancestor", ancestor, descendant], {
      cwd: repoPath,
      allowFailure: true,
    }).exitCode === 0
  );
}

export function fastForward(repoPath: string, ref: string): void {
  runGit(["merge", "--ff-only", ref], { cwd: repoPath });
}

/** The repo's current branch, or null when `repoPath` is not a git work tree or HEAD is detached. */
export function detectDefaultBranch(repoPath: string): string | null {
  const probe = runGit(["rev-parse", "--is-inside-work-tree"], {
    cwd: repoPath,
    allowFailure: true,
  });
  if (probe.exitCode !== 0 || probe.stdout.trim() !== "true") return null;
  const branch = currentBranch(repoPath);
  return branch === "" || branch === "HEAD" ? null : branch;
}

/** Whether a local branch ref exists. */
export function branchExists(repoPath: string, branch: string): boolean {
  const res = runGit(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], {
    cwd: repoPath,
    allowFailure: true,
  });
  return res.exitCode === 0;
}

/**
 * Whether `repoPath` is still the root of a git repository. Deliberately weaker
 * than {@link probeLocalRepository}: forking a worktree needs a repository root,
 * not the attached HEAD that registration insists on.
 */
export function isRepositoryRoot(repoPath: string): boolean {
  const canonical = tryRealpath(repoPath);
  if (canonical === null) return false;
  // `git` cannot even be spawned in a directory that vanished or is unreadable,
  // which is the same answer as "not a repository root", not a daemon failure.
  let toplevel: string;
  try {
    const result = runGit(["rev-parse", "--show-toplevel"], {
      cwd: canonical,
      allowFailure: true,
    });
    if (result.exitCode !== 0) return false;
    toplevel = result.stdout.trim();
  } catch {
    return false;
  }
  return toplevel !== "" && tryRealpath(toplevel) === canonical;
}

/** Local branch names, most recently committed first, so a base-branch picker leads with live work. */
export function listBranches(repoPath: string): string[] {
  const res = runGit(
    ["for-each-ref", "--sort=-committerdate", "--format=%(refname:short)", "refs/heads"],
    {
      cwd: repoPath,
      allowFailure: true,
    },
  );
  if (res.exitCode !== 0) return [];
  return res.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/** Deletes a local branch (`-D`, force). No-op tolerant when the branch is gone. */
export function deleteBranch(repoPath: string, branch: string): void {
  runGit(["branch", "-D", branch], { cwd: repoPath, allowFailure: true });
}
