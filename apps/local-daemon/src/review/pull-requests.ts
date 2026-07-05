import { randomUUID } from "node:crypto";

import {
  getPullRequestForRun,
  insertPullRequest,
  updatePullRequestDraft,
  type PullRequestRow,
} from "@otomat/db";
import type { PreparePullRequestRequest } from "@otomat/domain";

import { emitLedgerEvent } from "#events";

import { reloadOrThrow, type ReviewContext } from "./context.js";
import { buildPullRequestEvent } from "./events.js";
import type { PreparePullRequestResult } from "./types.js";

export function getPullRequest(ctx: ReviewContext, runId: string): PullRequestRow | null {
  return getPullRequestForRun(ctx.db, runId) ?? null;
}

/** Upserts the run's local PR draft (a stub — nothing is sent to a provider) and emits the ledger event. */
export function preparePullRequest(
  ctx: ReviewContext,
  runId: string,
  request: PreparePullRequestRequest,
): PreparePullRequestResult {
  const now = new Date().toISOString();
  const body = request.body === "" ? null : request.body;
  const existing = getPullRequestForRun(ctx.db, runId);
  if (existing) {
    updatePullRequestDraft(ctx.db, existing.id, { title: request.title, body });
    const updated = reloadOrThrow(
      () => getPullRequestForRun(ctx.db, runId),
      `pull request ${existing.id} vanished during update`,
    );
    emitLedgerEvent(
      ctx.db,
      ctx.dataDir,
      runId,
      buildPullRequestEvent(runId, "pr.updated", updated, now),
    );
    return { row: updated, created: false };
  }

  const id = randomUUID();
  insertPullRequest(ctx.db, {
    id,
    run_id: runId,
    provider: "github",
    status: "draft",
    title: request.title,
    body,
  });
  const created = reloadOrThrow(
    () => getPullRequestForRun(ctx.db, runId),
    `pull request ${id} vanished immediately after insert`,
  );
  emitLedgerEvent(
    ctx.db,
    ctx.dataDir,
    runId,
    buildPullRequestEvent(runId, "pr.created", created, now),
  );
  return { row: created, created: true };
}
