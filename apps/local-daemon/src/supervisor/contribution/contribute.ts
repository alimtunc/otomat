import { randomUUID } from "node:crypto";

import {
  appendRunContribution,
  cancelRunContribution as writeRunContributionCanceled,
  getRunContribution,
  listAgentSessionsForRun,
  listCompeteGroupsForRun,
  listStepRunsForRun,
  requeueRunContribution,
  type RunContributionRow,
} from "@otomat/db";
import {
  isRunContributionCancelable,
  isRunContributionRetriable,
  resolveStepContributionRoute,
} from "@otomat/domain";

import type { SupervisorState } from "../state.js";
import { assertContributionTransitions } from "../transitions.js";
import { deliverQueuedContributions } from "./deliver.js";
import { emitContributionEvent, requireRunContribution } from "./events.js";

/** No such message or step on this run — a bad id, not a conflict. */
export class RunContributionNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunContributionNotFoundError";
  }
}

/** The step exists but no turn of it will ever carry a message, so accepting one would be a lie. */
export class RunContributionStepClosedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunContributionStepClosedError";
  }
}

/** A retry the caller got wrong: the contribution is not failed, or it already reached the provider. */
export class RunContributionNotRetriableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunContributionNotRetriableError";
  }
}

/** A cancel the caller got wrong: a turn already claimed or carried the message. */
export class RunContributionNotCancelableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunContributionNotCancelableError";
  }
}

function assertStepAcceptsContributions(
  state: SupervisorState,
  runId: string,
  stepRunId: string,
): void {
  const step = listStepRunsForRun(state.db, runId).find((row) => row.id === stepRunId);
  if (!step) {
    throw new RunContributionNotFoundError(`step ${stepRunId} is not on run ${runId}`);
  }
  const route = resolveStepContributionRoute(
    step,
    listAgentSessionsForRun(state.db, runId),
    listCompeteGroupsForRun(state.db, runId),
  );
  if (route === null) {
    throw new RunContributionStepClosedError(
      `step ${stepRunId} is ${step.status} and will not run another turn`,
    );
  }
}

export async function contributeToRun(
  state: SupervisorState,
  runId: string,
  stepRunId: string,
  body: string,
): Promise<RunContributionRow> {
  assertStepAcceptsContributions(state, runId, stepRunId);
  const row = appendRunContribution(state.db, {
    id: randomUUID(),
    run_id: runId,
    step_run_id: stepRunId,
    body,
  });
  emitContributionEvent(state, row);
  await deliverQueuedContributions(state, runId);
  return requireRunContribution(state, row.id);
}

function requireOwnContribution(
  state: SupervisorState,
  runId: string,
  contributionId: string,
): RunContributionRow {
  const row = getRunContribution(state.db, contributionId);
  if (!row || row.run_id !== runId) {
    throw new RunContributionNotFoundError(`contribution ${contributionId} is not on this run`);
  }
  return row;
}

export async function retryRunContribution(
  state: SupervisorState,
  runId: string,
  contributionId: string,
): Promise<RunContributionRow> {
  const row = requireOwnContribution(state, runId, contributionId);
  if (!isRunContributionRetriable(row)) {
    throw new RunContributionNotRetriableError(
      row.delivered_at === null
        ? `contribution ${contributionId} is ${row.status}, not failed`
        : `contribution ${contributionId} already reached the agent and must not be sent twice`,
    );
  }
  assertContributionTransitions([row], "queued");
  requeueRunContribution(state.db, contributionId);
  emitContributionEvent(state, requireRunContribution(state, contributionId));
  await deliverQueuedContributions(state, runId);
  return requireRunContribution(state, contributionId);
}

export function cancelRunContribution(
  state: SupervisorState,
  runId: string,
  contributionId: string,
): RunContributionRow {
  const row = requireOwnContribution(state, runId, contributionId);
  if (!isRunContributionCancelable(row)) {
    throw new RunContributionNotCancelableError(
      row.agent_session_id === null
        ? `contribution ${contributionId} is ${row.status} and can no longer be withdrawn`
        : `contribution ${contributionId} is already on its way to the agent`,
    );
  }
  assertContributionTransitions([row], "canceled");
  writeRunContributionCanceled(state.db, contributionId, new Date().toISOString());
  const canceled = requireRunContribution(state, contributionId);
  emitContributionEvent(state, canceled);
  return canceled;
}
