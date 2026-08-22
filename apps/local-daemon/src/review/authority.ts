import { getRun } from "@otomat/db";
import type { ReviewFixAuthority } from "@otomat/domain";

import { reloadOrThrow } from "./reload.js";
import type { ReviewContext } from "./types.js";

/**
 * Only a publication Otomat made sets `pull_requests.run_id`, so a renamed
 * remote branch never moves ownership away from the run that pushed it.
 */
export function getFixAuthority(ctx: ReviewContext, runId: string): ReviewFixAuthority {
  const run = reloadOrThrow(() => getRun(ctx.db, runId), `run ${runId} vanished while read`);

  const worktree = ctx.repositories.forRun(runId)?.service.get(runId);
  if (!worktree) {
    return {
      kind: "external",
      reason: `Otomat holds no live worktree for ${run.branch}, so this diff is read-only.`,
    };
  }

  return { kind: "otomat", reason: `Otomat owns ${worktree.branch} in this repository.` };
}
