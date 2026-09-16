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

export function isDirty(cwd: string): boolean {
  return runGit(["status", "--porcelain"], { cwd }).stdout.trim() !== "";
}

function hasGitIdentity(cwd: string): boolean {
  const res = runGit(["config", "--get", "user.email"], { cwd, allowFailure: true });
  return res.exitCode === 0 && res.stdout.trim() !== "";
}

// `--untracked-files` is forced so a `status.showUntrackedFiles=no` config cannot hide work from the guard.
function statusLines(cwd: string): string[] {
  return runGit(["status", "--porcelain", "--untracked-files=normal"], { cwd })
    .stdout.split("\n")
    .filter(Boolean);
}

// Porcelain XY columns: a non-blank, non-`?` X is staged; a non-blank Y is unstaged or untracked work.
function hasStaged(lines: readonly string[]): boolean {
  return lines.some((line) => line[0] !== " " && line[0] !== "?");
}

function partiallyStaged(lines: readonly string[]): boolean {
  return hasStaged(lines) && lines.some((line) => line[1] !== " ");
}

/** Staged work beside unstaged or untracked work: a snapshot could only commit part of a selection the operator made. */
export function hasPartialStaging(cwd: string): boolean {
  return partiallyStaged(statusLines(cwd));
}

/** Commits the worktree's current state so an archived branch keeps the work. */
export function snapshotWorktree(cwd: string, message: string): void {
  const lines = statusLines(cwd);
  if (lines.length === 0) return;
  if (partiallyStaged(lines))
    throw new WorktreeConflictError(
      "This checkout has staged and unstaged changes. Commit your selection or stage the remaining changes before Otomat snapshots it.",
    );
  if (!hasStaged(lines)) runGit(["add", "-A"], { cwd });
  const env = hasGitIdentity(cwd) ? undefined : OTOMAT_IDENTITY;
  runGit(["-c", "commit.gpgsign=false", "commit", "--no-verify", "-m", message], { cwd, env });
}
