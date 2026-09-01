import { getAttachedPullRequest, getPullRequestForRun, type PullRequestRow } from "@otomat/db";

import { diffSnapshotOrNull, treeRangeSnapshot } from "#git";

import { getFixAuthority } from "./authority.js";
import { getDestinationAvailability } from "./destinations.js";
import {
  importedDestinations,
  importedFixAuthority,
  pullRequestTrees,
  runDiffBaseRef,
} from "./pull-request.js";
import type { ReviewContext, ReviewSubject, ReviewSubjectRef } from "./types.js";

function runSubject(ctx: ReviewContext, id: string, owner: string): ReviewSubject {
  return {
    id,
    ledgerRunId: id,
    snapshot: () => {
      const binding = ctx.repositories.forRun(id);
      if (binding === null) return null;
      return diffSnapshotOrNull(binding.service, owner, runDiffBaseRef(ctx.db, id));
    },
    fixAuthority: () => getFixAuthority(ctx, id),
    destinations: () => getDestinationAvailability(ctx, id),
    pullRequest: () => getPullRequestForRun(ctx.db, id) ?? null,
  };
}

/** The pinned `{base_sha, head_sha}` pair is what makes the diff, the anchors and the blobs describe one single imported head. */
function pullRequestSubject(ctx: ReviewContext, row: PullRequestRow): ReviewSubject {
  return {
    id: row.id,
    ledgerRunId: row.run_id,
    snapshot: () => {
      const binding = ctx.repositories.forRepository(row.repository_id);
      if (binding === null) return null;
      const trees = pullRequestTrees(row, binding);
      return trees === null ? null : treeRangeSnapshot(binding.rootPath, trees.base, trees.head);
    },
    fixAuthority: () => importedFixAuthority(row),
    destinations: () => importedDestinations(row),
    pullRequest: () => row,
  };
}

/** A pull request opened by a run is reviewed through that run, not as a subject of its own. */
export function pullRequestSubjectRef(row: PullRequestRow): ReviewSubjectRef {
  return row.run_id === null
    ? { kind: "pull_request", id: row.id }
    : { kind: "run", id: row.run_id };
}

export function resolveReviewSubject(ctx: ReviewContext, ref: ReviewSubjectRef): ReviewSubject {
  if (ref.kind === "run") return runSubject(ctx, ref.id, ref.owner ?? ref.id);
  const row = getAttachedPullRequest(ctx.db, ref.id);
  // The API guard already resolved the attachment; absence here is a detach racing this very request.
  if (!row) throw new Error(`pull request ${ref.id} vanished while attached`);
  return pullRequestSubject(ctx, row);
}
