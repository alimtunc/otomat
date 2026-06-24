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
