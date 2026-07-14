import { randomUUID } from "node:crypto";

import {
  getPullRequestForRun,
  getRepository,
  insertPullRequest,
  updatePullRequest,
  type Db,
  type PullRequestPatch,
  type PullRequestRow,
  type RunRow,
} from "@otomat/db";
import {
  pullRequestPublicationMachine,
  type EventSource,
  type GitHubConnectionContract,
  type PreparePullRequestRequest,
  type PullRequestPublicationState,
} from "@otomat/domain";

import { emitLedgerEvent } from "#events";
import type { GitWorktreeService } from "#git";

import { GitHubCliError } from "./cli.js";
import { buildPullRequestEvent } from "./events.js";
import type { GitHubCli, GitHubPullRequest } from "./types.js";

export interface PullRequestView {
  row: PullRequestRow;
  hasUnpublishedChanges: boolean | null;
}

export interface GitHubServiceConfig {
  db: Db;
  dataDir: string;
  worktrees: GitWorktreeService | null;
  cli: GitHubCli;
  idFactory?: () => string;
}

export interface GitHubService {
  connection(): Promise<GitHubConnectionContract>;
  connect(): GitHubConnectionContract;
  getPullRequest(runId: string): PullRequestView | null;
  publish(run: RunRow, request: PreparePullRequestRequest): Promise<PullRequestView>;
}

export class GitHubPublicationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GitHubPublicationError";
  }
}

const CONNECTING: GitHubConnectionContract = {
  status: "connecting",
  login: null,
  error_code: null,
  error_message: null,
};

function safeFailure(error: unknown): { code: string; message: string } {
  if (error instanceof GitHubCliError || error instanceof GitHubPublicationError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: "github_publication_failed",
    message: "GitHub publication failed unexpectedly.",
  };
}

function providerPatch(
  provider: GitHubPullRequest,
  snapshot: { headSha: string; diffSha: string },
): PullRequestPatch {
  return {
    provider: "github",
    number: provider.number,
    url: provider.url,
    status: provider.lifecycle,
    publication_status: "created",
    title: provider.title,
    body: provider.body,
    head_ref: provider.headRef,
    base_ref: provider.baseRef,
    published_head_sha: snapshot.headSha,
    published_diff_sha: snapshot.diffSha,
    error_code: null,
    error_message: null,
  };
}

/** Creates the daemon's single writer for GitHub connection and per-run PR publication. */
export function createGitHubService(config: GitHubServiceConfig): GitHubService {
  const { db, dataDir, worktrees, cli } = config;
  const idFactory = config.idFactory ?? randomUUID;
  const publications = new Map<string, Promise<PullRequestView>>();
  let login: Promise<GitHubConnectionContract> | null = null;
  let loginFailure: GitHubConnectionContract | null = null;

  function reload(runId: string): PullRequestRow {
    const row = getPullRequestForRun(db, runId);
    if (!row) throw new Error(`pull request for run ${runId} vanished`);
    return row;
  }

  function ensureRow(runId: string, request: PreparePullRequestRequest): PullRequestRow {
    const existing = getPullRequestForRun(db, runId);
    if (existing) return existing;
    try {
      insertPullRequest(db, {
        id: idFactory(),
        run_id: runId,
        provider: "github",
        status: "draft",
        publication_status: "not_configured",
        title: request.title,
        body: request.body === "" ? null : request.body,
      });
    } catch (error) {
      const raced = getPullRequestForRun(db, runId);
      if (!raced) throw error;
      return raced;
    }
    return reload(runId);
  }

  function emit(
    runId: string,
    type: "pr.created" | "pr.updated",
    source: EventSource,
    row: PullRequestRow,
  ): void {
    emitLedgerEvent(
      db,
      dataDir,
      runId,
      buildPullRequestEvent(runId, type, source, row, new Date().toISOString()),
    );
  }

  function patch(
    row: PullRequestRow,
    values: PullRequestPatch,
    source: EventSource,
    type: "pr.created" | "pr.updated" = "pr.updated",
  ): PullRequestRow {
    updatePullRequest(db, row.id, values);
    const updated = reload(row.run_id);
    emit(row.run_id, type, source, updated);
    return updated;
  }

  function transition(
    row: PullRequestRow,
    status: PullRequestPublicationState,
    values: PullRequestPatch,
    source: EventSource,
  ): PullRequestRow {
    if (row.publication_status !== status) {
      pullRequestPublicationMachine.transition(row.publication_status, status);
    }
    return patch(row, { ...values, publication_status: status }, source);
  }

  function failure(row: PullRequestRow, error: unknown): PullRequestRow {
    const safe = safeFailure(error);
    return transition(
      row,
      "failed",
      { error_code: safe.code, error_message: safe.message },
      "github",
    );
  }

  function recoverInterrupted(row: PullRequestRow): PullRequestRow {
    if (row.publication_status !== "pushing" && row.publication_status !== "creating") {
      return row;
    }
    return failure(
      row,
      new GitHubPublicationError(
        "github_publication_interrupted",
        "The previous GitHub publication was interrupted. Retry to reconcile it safely.",
      ),
    );
  }

  function view(row: PullRequestRow): PullRequestView {
    let hasUnpublishedChanges: boolean | null = false;
    if (row.published_diff_sha && !worktrees) {
      hasUnpublishedChanges = null;
    } else if (row.published_diff_sha && worktrees) {
      try {
        hasUnpublishedChanges = worktrees.diff(row.run_id).sha !== row.published_diff_sha;
      } catch {
        hasUnpublishedChanges = null;
      }
    }
    return { row, hasUnpublishedChanges };
  }

  async function publishOnce(
    run: RunRow,
    request: PreparePullRequestRequest,
  ): Promise<PullRequestView> {
    if (run.status !== "review_ready") {
      throw new GitHubPublicationError(
        "run_not_review_ready",
        "Only a review-ready run can publish a pull request.",
      );
    }
    let row = recoverInterrupted(ensureRow(run.id, request));
    if (!worktrees) {
      return view(
        failure(
          row,
          new GitHubPublicationError("worktree_missing", "The run has no active worktree."),
        ),
      );
    }
    let worktree;
    let initialDiff;
    try {
      worktree = worktrees.get(run.id);
      if (!worktree) {
        return view(
          failure(
            row,
            new GitHubPublicationError("worktree_missing", "The run has no active worktree."),
          ),
        );
      }
      initialDiff = worktrees.diff(run.id);
    } catch (error) {
      return view(failure(row, error));
    }
    if (initialDiff.files.length === 0) {
      return view(
        failure(
          row,
          new GitHubPublicationError("diff_empty", "The run has no changes to publish."),
        ),
      );
    }

    let connection: GitHubConnectionContract;
    try {
      connection = await cli.connection();
    } catch (error) {
      return view(failure(row, error));
    }
    if (connection.status !== "connected") {
      row = transition(
        row,
        "not_configured",
        {
          error_code: connection.error_code,
          error_message: connection.error_message,
          title: request.title,
          body: request.body === "" ? null : request.body,
        },
        "github",
      );
      return view(row);
    }

    let remote;
    try {
      remote = await cli.resolveRemote(worktree.path);
    } catch (error) {
      return view(failure(row, error));
    }

    if (row.number !== null && row.url !== null) {
      let provider: GitHubPullRequest;
      try {
        provider = await cli.viewPullRequest(worktree.path, remote.repository, row.number);
      } catch (error) {
        return view(failure(row, error));
      }
      if (provider.lifecycle === "merged" || provider.lifecycle === "closed") {
        row = patch(
          row,
          {
            status: provider.lifecycle,
            head_ref: provider.headRef,
            base_ref: provider.baseRef,
            error_code: null,
            error_message: null,
          },
          "github",
        );
        return view(row);
      }
      const current = view(row);
      const requestedBody = request.body === "" ? null : request.body;
      const metadataChanged = row.title !== request.title || row.body !== requestedBody;
      if (current.hasUnpublishedChanges === false && !metadataChanged) return current;
    }

    row = transition(
      row,
      "pushing",
      {
        title: request.title,
        body: request.body === "" ? null : request.body,
        error_code: null,
        error_message: null,
      },
      "git",
    );

    let snapshot;
    let diffAfterSnapshot;
    try {
      snapshot = worktrees.snapshot(run.id);
      diffAfterSnapshot = worktrees.diff(run.id);
      await cli.push(worktree.path, remote.name, worktree.branch);
    } catch (error) {
      return view(failure(row, error));
    }

    const selector = {
      cwd: worktree.path,
      repository: remote.repository,
      head: worktree.branch,
      base: getRepository(db, worktree.repositoryId)?.default_branch ?? "main",
    };

    let provider: GitHubPullRequest | null;
    try {
      provider = await cli.findPullRequest(selector);
      if (provider === null) {
        row = transition(row, "creating", {}, "github");
        await cli.createPullRequest({ ...selector, title: request.title, body: request.body });
        provider = await cli.findPullRequest(selector);
        if (provider === null) {
          throw new GitHubPublicationError(
            "github_pr_unconfirmed",
            "GitHub did not return the created pull request.",
          );
        }
      } else if (row.number !== null) {
        const requestedBody = request.body === "" ? null : request.body;
        if (provider.title !== request.title || provider.body !== requestedBody) {
          await cli.updatePullRequest({
            cwd: worktree.path,
            repository: remote.repository,
            number: provider.number,
            title: request.title,
            body: request.body,
          });
          provider = await cli.viewPullRequest(worktree.path, remote.repository, provider.number);
        }
      }
    } catch (error) {
      return view(failure(row, error));
    }

    const values = providerPatch(provider, {
      headSha: snapshot.headSha,
      diffSha: diffAfterSnapshot.sha,
    });
    const eventType = row.number === null ? "pr.created" : "pr.updated";
    row = patch(row, values, "github", eventType);
    return view(row);
  }

  return {
    async connection() {
      if (login) return CONNECTING;
      const status = await cli.connection();
      if (status.status === "connected") loginFailure = null;
      return status.status === "connected" ? status : (loginFailure ?? status);
    },
    connect() {
      if (!login) {
        loginFailure = null;
        login = cli
          .login()
          .then((status) => {
            if (status.status !== "connected") loginFailure = status;
            return status;
          })
          .catch((error: unknown) => {
            const safe = safeFailure(error);
            loginFailure = {
              status: "failed",
              login: null,
              error_code: safe.code,
              error_message: safe.message,
            };
            return loginFailure;
          })
          .finally(() => {
            login = null;
          });
      }
      return CONNECTING;
    },
    getPullRequest(runId) {
      let row = getPullRequestForRun(db, runId);
      if (row && !publications.has(runId)) row = recoverInterrupted(row);
      return row ? view(row) : null;
    },
    publish(run, request) {
      const active = publications.get(run.id);
      if (active) return active;
      const operation = publishOnce(run, request).finally(() => publications.delete(run.id));
      publications.set(run.id, operation);
      return operation;
    },
  };
}
