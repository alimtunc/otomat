import { formatCommitSubject } from "@otomat/domain";

import { WorktreeConflictError } from "./errors.js";
import { runGit } from "./git-cli.js";

const OTOMAT_IDENTITY = {
  GIT_AUTHOR_NAME: "Otomat",
  GIT_AUTHOR_EMAIL: "otomat@local",
  GIT_COMMITTER_NAME: "Otomat",
  GIT_COMMITTER_EMAIL: "otomat@local",
} as const;

/** Otomat's internal commits carry the same subject contract as the ones it publishes. */
export function snapshotSubject(action: string, owner: string): string {
  return formatCommitSubject({ type: "chore", scope: "worktree", summary: `${action} ${owner}` });
}

export async function isDirty(cwd: string): Promise<boolean> {
  return (
    (await runGit(["--no-optional-locks", "status", "--porcelain"], { cwd })).stdout.trim() !== ""
  );
}

async function hasGitIdentity(cwd: string): Promise<boolean> {
  const res = await runGit(["config", "--get", "user.email"], { cwd, allowFailure: true });
  return res.exitCode === 0 && res.stdout.trim() !== "";
}

// `--untracked-files` is forced so a `status.showUntrackedFiles=no` config cannot hide work from the guard.
async function statusLines(cwd: string): Promise<string[]> {
  const status = await runGit(
    ["--no-optional-locks", "status", "--porcelain", "--untracked-files=normal"],
    { cwd },
  );
  return status.stdout.split("\n").filter(Boolean);
}

// Porcelain XY columns: a non-blank, non-`?` X is staged; a non-blank Y is unstaged or untracked work.
function hasStaged(lines: readonly string[]): boolean {
  return lines.some((line) => line[0] !== " " && line[0] !== "?");
}

function partiallyStaged(lines: readonly string[]): boolean {
  return hasStaged(lines) && lines.some((line) => line[1] !== " ");
}

/** Staged work beside unstaged or untracked work: a snapshot could only commit part of a selection the operator made. */
export async function hasPartialStaging(cwd: string): Promise<boolean> {
  return partiallyStaged(await statusLines(cwd));
}

/** Commits the worktree's current state so an archived branch keeps the work. */
export async function snapshotWorktree(cwd: string, message: string): Promise<void> {
  const lines = await statusLines(cwd);
  if (lines.length === 0) return;
  if (partiallyStaged(lines))
    throw new WorktreeConflictError(
      "This checkout has staged and unstaged changes. Commit your selection or stage the remaining changes before Otomat snapshots it.",
    );
  if (!hasStaged(lines)) await runGit(["add", "-A"], { cwd });
  const env = (await hasGitIdentity(cwd)) ? undefined : OTOMAT_IDENTITY;
  await runGit(["-c", "commit.gpgsign=false", "commit", "--no-verify", "-m", message], {
    cwd,
    env,
  });
}
