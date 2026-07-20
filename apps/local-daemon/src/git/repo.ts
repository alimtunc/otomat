import { runGit } from "./git-cli.js";

/** Resolves a ref (branch, tag, sha, `<ref>^{tree}`, ...) to its object id. */
export function revParse(repoPath: string, ref: string): string {
  return runGit(["rev-parse", ref], { cwd: repoPath }).stdout.trim();
}

/** Current `HEAD` commit sha of the repo or worktree at `repoPath`. */
export function headSha(repoPath: string): string {
  return revParse(repoPath, "HEAD");
}

/** Short symbolic name of the checked-out branch (e.g. `main`). */
export function currentBranch(repoPath: string): string {
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

/** Deletes a local branch (`-D`, force). No-op tolerant when the branch is gone. */
export function deleteBranch(repoPath: string, branch: string): void {
  runGit(["branch", "-D", branch], { cwd: repoPath, allowFailure: true });
}
