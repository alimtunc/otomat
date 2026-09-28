import { runGit } from "./git-cli.js";
import { repositoryRemotes, verifyRef } from "./repo.js";

export async function listBranches(repoPath: string): Promise<string[]> {
  const res = await runGit(
    ["for-each-ref", "--sort=-committerdate", "--format=%(refname:short)", "refs/heads"],
    {
      cwd: repoPath,
      allowFailure: true,
    },
  );
  if (res.exitCode !== 0) return [];
  const local = res.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
  const [remote, ...otherRemotes] = await repositoryRemotes(repoPath);
  if (remote === undefined || otherRemotes.length > 0) return local;
  const advertised = await runGit(["ls-remote", "--heads", remote], {
    cwd: repoPath,
    env: { GIT_TERMINAL_PROMPT: "0" },
    allowFailure: true,
    timeoutMs: 10_000,
  });
  if (advertised.exitCode !== 0)
    throw new Error("Could not read the repository's remote branches.");
  const branches = new Set(local);
  for (const line of advertised.stdout.split("\n")) {
    const ref = line.split("\t")[1];
    if (ref?.startsWith("refs/heads/")) branches.add(ref.slice("refs/heads/".length));
  }
  return [...branches];
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
