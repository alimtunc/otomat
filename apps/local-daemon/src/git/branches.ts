import { runGit } from "./git-cli.js";
import { verifyRef } from "./repo.js";

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

/** Whether a local branch ref exists. */
export function branchExists(repoPath: string, branch: string): boolean {
  return verifyRef(repoPath, `refs/heads/${branch}`) !== null;
}

/** `check-ref-format` reads a leading dash as an option, so that shape is refused before git is asked. */
export function isValidBranchName(repoPath: string, branch: string): boolean {
  if (branch.startsWith("-")) return false;
  return (
    runGit(["check-ref-format", `refs/heads/${branch}`], { cwd: repoPath, allowFailure: true })
      .exitCode === 0
  );
}

export function switchToNewBranch(repoPath: string, branch: string): string | null {
  const result = runGit(["switch", "-c", branch], { cwd: repoPath, allowFailure: true });
  return result.exitCode === 0 ? null : result.stderr.trim() || "Could not create this branch.";
}

/** Deletes a local branch (`-D`, force). No-op tolerant when the branch is gone. */
export function deleteBranch(repoPath: string, branch: string): void {
  runGit(["branch", "-D", branch], { cwd: repoPath, allowFailure: true });
}

/** `push --set-upstream` only tracks a branch it pushed by name; a push by sha leaves this to do. */
export function setUpstream(repoPath: string, branch: string, remote: string): void {
  runGit(["branch", `--set-upstream-to=${remote}/${branch}`, branch], { cwd: repoPath });
}
