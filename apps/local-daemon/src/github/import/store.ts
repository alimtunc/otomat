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

import type { GitHubPullRequest } from "../types.js";

export interface ImportStoreConfig extends MergeClosureConfig {
  idFactory(): string;
}

export interface AttachmentInput {
  issueId: string;
  repositoryId: string;
  provider: GitHubPullRequest;
  provenance: PullRequestProvenance;
  evidence: PullRequestEvidence;
  attachedBy: string | null;
  /** The two ends the review diff is pinned to, resolved when the head was fetched. */
  trees: PullRequestTrees;
}

function reload(config: ImportStoreConfig, id: string): PullRequestRow {
  const row = getPullRequest(config.db, id);
  if (!row) throw new Error(`pull request ${id} vanished while attached`);
  return row;
}

/**
 * Records an attachment with the evidence it was verified on. The provider's own
 * state is the initial one: a pull request attached already merged was never
 * `draft` here, and no state machine may pretend it walked there.
 */
export function insertAttachedPullRequest(
  config: ImportStoreConfig,
  input: AttachmentInput,
): PullRequestRow {
  const id = config.idFactory();
  const now = new Date().toISOString();
  insertPullRequest(config.db, {
    id,
    issue_id: input.issueId,
    repository_id: input.repositoryId,
    provider: "github",
    origin: "imported",
    provenance: input.provenance,
    author_login: input.provider.authorLogin,
    number: input.provider.number,
    url: input.provider.url,
    status: input.provider.lifecycle,
    publication_status: "created",
    title: input.provider.title,
    body: input.provider.body,
    head_ref: input.provider.headRef,
    base_ref: input.provider.baseRef,
    head_sha: input.trees.head,
    base_sha: input.trees.base,
    attached_at: now,
    attached_by: input.attachedBy,
    attachment_evidence: JSON.stringify(input.evidence),
  });
  const row = reload(config, id);
  return settleLifecycle(config, row);
}

/** Mirrors what GitHub answers now, head sha included: a refreshed head is what re-pins the review. */
export function applyProviderState(
  config: ImportStoreConfig,
  row: PullRequestRow,
  provider: GitHubPullRequest,
  provenance: PullRequestProvenance,
  trees: PullRequestTrees,
): PullRequestRow {
  updatePullRequest(config.db, row.id, {
    provenance,
    author_login: provider.authorLogin,
    url: provider.url,
    title: provider.title,
    body: provider.body,
    head_ref: provider.headRef,
    base_ref: provider.baseRef,
    head_sha: trees.head,
    base_sha: trees.base,
    error_code: null,
    error_message: null,
  });
  let current = reload(config, row.id);
  drivePath(pullRequestMachine, current.status, provider.lifecycle, (next) => {
    updatePullRequest(config.db, current.id, { status: next });
    current = reload(config, current.id);
  });
  return settleLifecycle(config, current);
}

/** A confirmed merge closes the issue's cycle here too; a close leaves the cycle alone and only ends the review projection. */
function settleLifecycle(config: ImportStoreConfig, row: PullRequestRow): PullRequestRow {
  if (row.status === "merged") closeMergedIssue(config, row.issue_id);
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
