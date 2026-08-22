import { randomUUID } from "node:crypto";

import {
  appendRunContribution,
  cancelRunContribution as writeRunContributionCanceled,
  getRun,
  getRunContribution,
  getStepRun,
  listAgentSessionsForRun,
  listCompeteGroupsForRun,
  requeueRunContribution,
  type AgentSessionRow,
  type RunContributionRow,
  type StepRunRow,
} from "@otomat/db";
import {
  executableSteps,
  isRunContributionCancelable,
  isRunContributionRetriable,
  resolveStepContributionRoute,
  type ResolvedAgentConfig,
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

export class RunContributionTargetChangedError extends Error {
  constructor(
    readonly code: "session_changed" | "config_changed" | "config_unavailable",
    message: string,
  ) {
    super(message);
    this.name = "RunContributionTargetChangedError";
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

interface AcceptingStep {
  step: StepRunRow;
  sessions: AgentSessionRow[];
}

function stepAcceptingContributions(
  state: SupervisorState,
  runId: string,
  stepRunId: string,
): AcceptingStep {
  const step = getStepRun(state.db, stepRunId);
  if (!step || step.run_id !== runId) {
    throw new RunContributionNotFoundError(`step ${stepRunId} is not on run ${runId}`);
  }
  const sessions = listAgentSessionsForRun(state.db, runId);
  const route = resolveStepContributionRoute(
    step,
    sessions,
    listCompeteGroupsForRun(state.db, runId),
  );
  if (route === null) {
    throw new RunContributionStepClosedError(
      `step ${stepRunId} is ${step.status} and will not run another turn`,
    );
  }
  return { step, sessions: sessions.filter((session) => session.step_run_id === stepRunId) };
}

interface ContributionTarget {
  sessionId: string | null;
  config: ResolvedAgentConfig;
}

function contributionTarget(
  state: SupervisorState,
  runId: string,
  { step, sessions }: AcceptingStep,
  requestedSessionId: string | null,
  requestedConfigHash: string,
): ContributionTarget {
  const run = getRun(state.db, runId);
  if (!run) throw new RunContributionNotFoundError(`run ${runId} not found`);
  const session =
    requestedSessionId === null
      ? null
      : sessions.find((candidate) => candidate.id === requestedSessionId);
  if (requestedSessionId !== null && session === undefined) {
    throw new RunContributionTargetChangedError(
      "session_changed",
      "The selected participant session is no longer available. Refresh the conversation target.",
    );
  }
  if (requestedSessionId === null && sessions.length > 0) {
    throw new RunContributionTargetChangedError(
      "session_changed",
      "This step now has a participant session. Refresh before sending the message.",
    );
  }
  const planConfig = executableSteps(run.plan_json).find(
    (candidate) => candidate.id === step.id,
  )?.config;
  const config = step.next_turn_config_json ?? session?.config_json ?? planConfig ?? null;
  if (config === null) {
    throw new RunContributionTargetChangedError(
      "config_unavailable",
      "The selected participant has no frozen execution configuration.",
    );
  }
  if (config.config_hash !== requestedConfigHash) {
    throw new RunContributionTargetChangedError(
      "config_changed",
      "The selected participant configuration changed before this message was queued. Review it and send again.",
    );
  }
  return { sessionId: requestedSessionId, config };
}

export async function contributeToRun(
  state: SupervisorState,
  runId: string,
  stepRunId: string,
  targetAgentSessionId: string | null,
  targetConfigHash: string,
  body: string,
): Promise<RunContributionRow> {
  const accepting = stepAcceptingContributions(state, runId, stepRunId);
  const target = contributionTarget(
    state,
    runId,
    accepting,
    targetAgentSessionId,
    targetConfigHash,
  );
  const row = appendRunContribution(state.db, {
    id: randomUUID(),
    run_id: runId,
    step_run_id: stepRunId,
    body,
    target_agent_session_id: target.sessionId,
    target_config_json: target.config,
  });
  emitContributionEvent(state, row);
  state.stopHeld.delete(stepRunId);
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
  state.stopHeld.delete(row.step_run_id);
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
