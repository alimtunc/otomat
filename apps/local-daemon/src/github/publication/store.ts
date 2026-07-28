import {
  getPullRequestForRun,
  insertPullRequest,
  updatePullRequest,
  type PullRequestPatch,
  type PullRequestRow,
} from "@otomat/db";
import {
  drivePath,
  pullRequestMachine,
  pullRequestPublicationMachine,
  type EventSource,
  type PullRequestPublicationState,
  type PullRequestState,
} from "@otomat/domain";

import { emitLedgerEvent } from "#events";

import { GitHubPublicationError, safeGitHubFailure } from "../errors.js";
import { buildPullRequestEvent, type PullRequestEventType } from "../events.js";
import type { PullRequestView } from "../types.js";
import type { PublicationConfig } from "./types.js";

/** Row persistence, ledger emission, and state-machine reconciliation for one publication. */
export class PublicationStore {
  constructor(private readonly config: PublicationConfig) {}

  reload(runId: string): PullRequestRow {
    const row = getPullRequestForRun(this.config.db, runId);
    if (!row) throw new Error(`pull request for run ${runId} vanished`);
    return row;
  }

  ensureRow(runId: string, title: string, body: string | null): PullRequestRow {
    const existing = getPullRequestForRun(this.config.db, runId);
    if (existing) return existing;
    try {
      insertPullRequest(this.config.db, {
        id: this.config.idFactory(),
        run_id: runId,
        provider: "github",
        status: "draft",
        publication_status: "not_configured",
        title,
        body,
      });
    } catch (error) {
      const raced = getPullRequestForRun(this.config.db, runId);
      if (!raced) throw error;
      return raced;
    }
    return this.reload(runId);
  }

  patch(
    row: PullRequestRow,
    values: PullRequestPatch,
    source: EventSource,
    type: PullRequestEventType = "pr.updated",
  ): PullRequestRow {
    updatePullRequest(this.config.db, row.id, values);
    const updated = this.reload(row.run_id);
    emitLedgerEvent(
      this.config.db,
      this.config.dataDir,
      row.run_id,
      buildPullRequestEvent(row.run_id, type, source, updated, new Date().toISOString()),
    );
    return updated;
  }

  transition(
    row: PullRequestRow,
    status: PullRequestPublicationState,
    values: PullRequestPatch,
    source: EventSource,
    type: PullRequestEventType = "pr.updated",
  ): PullRequestRow {
    if (row.publication_status !== status) {
      pullRequestPublicationMachine.transition(row.publication_status, status);
    }
    return this.patch(row, { ...values, publication_status: status }, source, type);
  }

  reconcileLifecycle(row: PullRequestRow, status: PullRequestState): PullRequestRow {
    let current = row;
    drivePath(pullRequestMachine, row.status, status, (next) => {
      current = this.patch(current, { status: next }, "github");
    });
    return current;
  }

  reconcilePublication(row: PullRequestRow, status: PullRequestPublicationState): PullRequestRow {
    let current = row;
    drivePath(pullRequestPublicationMachine, row.publication_status, status, (next) => {
      current = this.patch(
        current,
        { publication_status: next, error_code: null, error_message: null },
        "github",
      );
    });
    return current;
  }

  failure(row: PullRequestRow, error: unknown): PullRequestRow {
    const failure = safeGitHubFailure(error);
    return this.transition(
      row,
      "failed",
      { error_code: failure.code, error_message: failure.message },
      "github",
    );
  }

  recoverInterrupted(row: PullRequestRow): PullRequestRow {
    if (row.publication_status !== "pushing" && row.publication_status !== "creating") return row;
    return this.failure(
      row,
      new GitHubPublicationError(
        "github_publication_interrupted",
        "The previous GitHub publication was interrupted. Retry to reconcile it safely.",
      ),
    );
  }

  view(row: PullRequestRow): PullRequestView {
    if (!row.published_diff_sha) return { row, hasUnpublishedChanges: false };
    const service = this.config.repositories.forRun(row.run_id)?.service;
    if (!service) return { row, hasUnpublishedChanges: null };
    try {
      return {
        row,
        hasUnpublishedChanges: service.diff(row.run_id).sha !== row.published_diff_sha,
      };
    } catch (error) {
      // Unknown beats a false up-to-date claim, but the failure must stay visible.
      console.error(`[otomat] diff comparison for run ${row.run_id} failed`, error);
      return { row, hasUnpublishedChanges: null };
    }
  }
}
