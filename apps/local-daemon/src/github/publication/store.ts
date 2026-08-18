import {
  getPullRequestForRun,
  insertPullRequest,
  listStepRunsForRun,
  updatePullRequest,
  type PullRequestPatch,
  type PullRequestRow,
  type RunRow,
} from "@otomat/db";
import {
  drivePath,
  pullRequestMachine,
  pullRequestPublicationMachine,
  type EventSource,
  type PullRequestProposal,
  type PullRequestPublicationState,
  type PullRequestState,
} from "@otomat/domain";

import { emitLedgerEvent } from "#events";
import { closeMergedRun } from "#supervisor";

import { GitHubPublicationError, safeGitHubFailure } from "../errors.js";
import {
  buildPublicationOverrideEvent,
  buildPullRequestEvent,
  type PullRequestEventType,
} from "../events.js";
import type { ComposedSubject, PublicationConfig } from "./types.js";

/** Publication only ever acts on a pull request Otomat opened for a run; a row without one never reaches these paths. */
export function publicationRunId(row: PullRequestRow): string {
  if (row.run_id === null) throw new Error(`pull request ${row.id} was adopted, not published`);
  return row.run_id;
}

/** Row persistence, ledger emission, and state-machine reconciliation for one publication. */
export class PublicationStore {
  constructor(private readonly config: PublicationConfig) {}

  reload(runId: string): PullRequestRow {
    const row = getPullRequestForRun(this.config.db, runId);
    if (!row) throw new Error(`pull request for run ${runId} vanished`);
    return row;
  }

  ensureRow(run: RunRow, title: string, body: string | null): PullRequestRow {
    const existing = getPullRequestForRun(this.config.db, run.id);
    if (existing) return existing;
    try {
      insertPullRequest(this.config.db, {
        id: this.config.idFactory(),
        issue_id: run.issue_id,
        run_id: run.id,
        repository_id: run.repository_id,
        provider: "github",
        origin: "otomat",
        provenance: "otomat",
        status: "draft",
        publication_status: "not_configured",
        title,
        body,
      });
    } catch (error) {
      const raced = getPullRequestForRun(this.config.db, run.id);
      if (!raced) throw error;
      return raced;
    }
    return this.reload(run.id);
  }

  patch(
    row: PullRequestRow,
    values: PullRequestPatch,
    source: EventSource,
    type: PullRequestEventType = "pr.updated",
  ): PullRequestRow {
    const runId = publicationRunId(row);
    updatePullRequest(this.config.db, row.id, values);
    const updated = this.reload(runId);
    emitLedgerEvent(
      this.config.db,
      this.config.dataDir,
      runId,
      buildPullRequestEvent(runId, type, source, updated, new Date().toISOString()),
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

  /** Landing on `merged` settles the run in the same breath: worktree, branch and issue. */
  reconcileLifecycle(row: PullRequestRow, status: PullRequestState): PullRequestRow {
    let current = row;
    let merged = false;
    drivePath(pullRequestMachine, row.status, status, (next) => {
      current = this.patch(current, { status: next }, "github");
      merged ||= next === "merged";
    });
    if (merged) {
      closeMergedRun(
        {
          db: this.config.db,
          dataDir: this.config.dataDir,
          repositories: this.config.repositories,
          syncIssueLifecycle: this.config.syncIssueLifecycle,
        },
        publicationRunId(row),
      );
    }
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

  /** The proposal is the durable publication draft: it survives a reload of the cockpit. */
  recordProposal(
    run: RunRow,
    proposal: PullRequestProposal,
    subject: ComposedSubject,
  ): PullRequestRow {
    const row = this.ensureRow(run, subject.title, proposal.body);
    return this.patch(
      row,
      {
        title: subject.title,
        body: proposal.body,
        ...(row.number === null ? { head_ref: proposal.branch } : {}),
        commit_subject: subject.subjectLine,
        commit_body: proposal.commit_body,
        generator_runtime: proposal.generator.runtime,
        generator_model: proposal.generator.model,
        generator_effort: proposal.generator.effort,
      },
      "otomat",
    );
  }

  /** Nothing is rewritten: the run keeps its status and every step keeps its own. */
  recordExecutionOverride(row: PullRequestRow, run: RunRow): void {
    emitLedgerEvent(
      this.config.db,
      this.config.dataDir,
      run.id,
      buildPublicationOverrideEvent(row, run, listStepRunsForRun(this.config.db, run.id)),
    );
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

  /** Publication status is left alone: the pull request was created and still is — only this push did not land. */
  recordPushFailure(row: PullRequestRow, error: unknown): GitHubPublicationError {
    console.error(`[otomat] push for run ${row.run_id} failed`, error);
    const failure = safeGitHubFailure(error, {
      code: "github_push_failed",
      message: "The commits could not be pushed to GitHub.",
    });
    this.patch(row, { error_code: failure.code, error_message: failure.message }, "github");
    return new GitHubPublicationError(failure.code, failure.message);
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
}
