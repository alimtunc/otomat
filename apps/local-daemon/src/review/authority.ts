import { getPullRequestForRun, getRun } from "@otomat/db";
import type { ReviewFixAuthority } from "@otomat/domain";

import { reloadOrThrow } from "./reload.js";
import type { ReviewContext } from "./types.js";

export function getFixAuthority(ctx: ReviewContext, runId: string): ReviewFixAuthority {
  const run = reloadOrThrow(() => getRun(ctx.db, runId), `run ${runId} vanished while read`);

  const pullRequest = getPullRequestForRun(ctx.db, runId);
  if (pullRequest && pullRequest.head_ref !== null && pullRequest.head_ref !== run.branch) {
    return {
      kind: "external",
      reason: `This pull request is open on ${pullRequest.head_ref}, a branch Otomat does not own. You can review it here, not rewrite it.`,
    };
  }

  const worktree = ctx.repositories.forRun(runId)?.service.get(runId);
  if (!worktree) {
    return {
      kind: "external",
      reason: `Otomat holds no live worktree for ${run.branch}, so this diff is read-only.`,
    };
  }

  return { kind: "otomat", reason: `Otomat owns ${worktree.branch} in this repository.` };
}
