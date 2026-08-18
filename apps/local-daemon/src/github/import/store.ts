import {
  getPullRequest,
  insertPullRequest,
  updatePullRequest,
  type PullRequestRow,
} from "@otomat/db";
import {
  drivePath,
  pullRequestMachine,
  type PullRequestEvidence,
  type PullRequestProvenance,
} from "@otomat/domain";

import type { PullRequestTrees } from "#git";
import { closeMergedIssue, type MergeClosureConfig } from "#supervisor";

import { mirroredColumns } from "../mirror.js";
import type { GitHubPullRequest } from "../types.js";

export interface ImportStoreConfig extends MergeClosureConfig {
  idFactory(): string;
}

export interface MirrorInput {
  issueId: string | null;
  repositoryId: string;
  provider: GitHubPullRequest;
  provenance: PullRequestProvenance;
  /** Null for a pull request a reconciliation pass mirrored: mirroring is not an adoption. */
  evidence: PullRequestEvidence | null;
  attachedBy: string | null;
  /** The two ends the review diff is pinned to; null until a head is fetched for review. */
  trees: PullRequestTrees | null;
  syncedAt: string | null;
}

function reload(config: ImportStoreConfig, id: string): PullRequestRow {
  const row = getPullRequest(config.db, id);
  if (!row) throw new Error(`pull request ${id} vanished while attached`);
  return row;
}

/** The provider's own state is the initial one; no state machine may pretend it walked there. */
export function insertMirroredPullRequest(
  config: ImportStoreConfig,
  input: MirrorInput,
): PullRequestRow {
  const id = config.idFactory();
  const adoption =
    input.evidence === null
      ? {}
      : {
          attached_at: new Date().toISOString(),
          attached_by: input.attachedBy,
          attachment_evidence: JSON.stringify(input.evidence),
        };
  insertPullRequest(config.db, {
    id,
    issue_id: input.issueId,
    repository_id: input.repositoryId,
    provider: "github",
    origin: "imported",
    provenance: input.provenance,
    ...mirroredColumns(input.provider),
    number: input.provider.number,
    status: input.provider.lifecycle,
    publication_status: "created",
    ...(input.trees === null ? {} : { head_sha: input.trees.head, base_sha: input.trees.base }),
    synced_at: input.syncedAt,
    ...adoption,
  });
  return settleLifecycle(config, reload(config, id));
}

export interface ProviderStateInput {
  provider: GitHubPullRequest;
  provenance: PullRequestProvenance;
  /** Null leaves the pinned review head alone: a metadata pass must never unpin a fetched diff. */
  trees: PullRequestTrees | null;
  /** Set by a reconciliation pass, which stamps the watermark and leaves a publication failure standing. */
  syncedAt: string | null;
}

/** Mirrors what GitHub answers now, head sha included: a refreshed head is what re-pins the review. */
export function applyProviderState(
  config: ImportStoreConfig,
  row: PullRequestRow,
  input: ProviderStateInput,
): PullRequestRow {
  updatePullRequest(config.db, row.id, {
    provenance: input.provenance,
    ...mirroredColumns(input.provider),
    ...(input.trees === null ? {} : { head_sha: input.trees.head, base_sha: input.trees.base }),
    ...(input.syncedAt === null
      ? { error_code: null, error_message: null }
      : { synced_at: input.syncedAt }),
  });
  let current = reload(config, row.id);
  drivePath(pullRequestMachine, current.status, input.provider.lifecycle, (next) => {
    updatePullRequest(config.db, current.id, { status: next });
    current = reload(config, current.id);
  });
  return settleLifecycle(config, current);
}

/** A confirmed merge closes the issue's cycle here too; a close leaves the cycle alone and only ends the review projection. */
function settleLifecycle(config: ImportStoreConfig, row: PullRequestRow): PullRequestRow {
  if (row.status === "merged" && row.issue_id !== null) closeMergedIssue(config, row.issue_id);
  return reload(config, row.id);
}

/** Detaching keeps the row: the audit has to answer what was attached, on what evidence, and when it was removed. */
export function markPullRequestDetached(
  config: ImportStoreConfig,
  row: PullRequestRow,
): PullRequestRow {
  updatePullRequest(config.db, row.id, { detached_at: new Date().toISOString() });
  return reload(config, row.id);
}
