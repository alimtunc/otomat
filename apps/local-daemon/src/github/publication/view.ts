import type { PullRequestRow } from "@otomat/db";
import type { PullRequestSync } from "@otomat/domain";

import type { PullRequestView } from "../types.js";
import { publicationRunId } from "./store.js";
import { computeSync, UNAVAILABLE_SYNC } from "./sync.js";
import type { PublicationConfig } from "./types.js";
import { resolveWorkspace } from "./workspace.js";

/** A comparison that could not be made is still a comparison: only an absent branch answers null. */
async function publicationSync(
  config: PublicationConfig,
  row: PullRequestRow,
): Promise<PullRequestSync | null> {
  if (row.number === null || row.head_ref === null) return null;
  if (row.status === "merged" || row.status === "closed") return null;
  try {
    const workspace = await resolveWorkspace(config, publicationRunId(row));
    return await computeSync({
      cli: config.cli,
      worktreePath: workspace.worktree.path,
      remote: workspace.remote.name,
      headRef: row.head_ref,
      baseRef: workspace.baseRef,
    });
  } catch (error) {
    console.error(`[otomat] workspace for run ${row.run_id} could not be compared`, error);
    return UNAVAILABLE_SYNC;
  }
}

export async function publicationView(
  config: PublicationConfig,
  row: PullRequestRow,
): Promise<PullRequestView> {
  return { row, sync: await publicationSync(config, row) };
}
