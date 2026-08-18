import { formatCommitSubject } from "@otomat/domain";

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

/** Commits the worktree's current state so an archived branch keeps the work. */
export function snapshotWorktree(cwd: string, message: string): void {
  if (!isDirty(cwd)) return;
  runGit(["add", "-A"], { cwd });
  const env = hasGitIdentity(cwd) ? undefined : OTOMAT_IDENTITY;
  runGit(["-c", "commit.gpgsign=false", "commit", "--no-verify", "-m", message], { cwd, env });
}
