import { runGit } from "./git-cli.js";
import { verifyRef } from "./repo.js";

/** Local branch names, most recently committed first, so a base-branch picker leads with live work. */
export async function listBranches(repoPath: string): Promise<string[]> {
  const res = await runGit(
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
export async function branchExists(repoPath: string, branch: string): Promise<boolean> {
  return (await verifyRef(repoPath, `refs/heads/${branch}`)) !== null;
}

/** `check-ref-format` reads a leading dash as an option, so that shape is refused before git is asked. */
export async function isValidBranchName(repoPath: string, branch: string): Promise<boolean> {
  if (branch.startsWith("-")) return false;
  const res = await runGit(["check-ref-format", `refs/heads/${branch}`], {
    cwd: repoPath,
    allowFailure: true,
  });
  return res.exitCode === 0;
}

export async function switchToNewBranch(repoPath: string, branch: string): Promise<string | null> {
  const result = await runGit(["switch", "-c", branch], { cwd: repoPath, allowFailure: true });
  return result.exitCode === 0 ? null : result.stderr.trim() || "Could not create this branch.";
}

/** Deletes a local branch (`-D`, force). No-op tolerant when the branch is gone. */
export async function deleteBranch(repoPath: string, branch: string): Promise<void> {
  await runGit(["branch", "-D", branch], { cwd: repoPath, allowFailure: true });
}

/** `push --set-upstream` only tracks a branch it pushed by name; a push by sha leaves this to do. */
export async function setUpstream(repoPath: string, branch: string, remote: string): Promise<void> {
  await runGit(["branch", `--set-upstream-to=${remote}/${branch}`, branch], { cwd: repoPath });
}
