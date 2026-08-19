import { shortSha, type RunCommit } from "@otomat/domain";

import { WorktreeNotFoundError, type CommitSummary } from "#git";

import type { ReviewContext } from "./types.js";

export function toRunCommit(commit: CommitSummary): RunCommit {
  return {
    sha: commit.sha,
    short_sha: shortSha(commit.sha),
    subject: commit.subject,
    author_name: commit.authorName,
    authored_at: commit.authoredAt,
  };
}

interface BranchCommits {
  commits: RunCommit[];
  unavailable: string | null;
}

/** An unreadable history is reported, never rendered as a branch with no commits. */
export function getBranchCommits(ctx: ReviewContext, runId: string): BranchCommits {
  const service = ctx.repositories.forRun(runId)?.service ?? null;
  if (service === null) {
    return { commits: [], unavailable: "This run has no git repository to read commits from." };
  }
  try {
    return { commits: service.branchCommits(runId).map(toRunCommit), unavailable: null };
  } catch (error) {
    if (error instanceof WorktreeNotFoundError) {
      return {
        commits: [],
        unavailable: "This run's worktree is gone, so its commits cannot be listed.",
      };
    }
    throw error;
  }
}
