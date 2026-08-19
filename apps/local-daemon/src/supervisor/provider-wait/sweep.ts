import {
  listStepsWaitingForProvider,
  setStepProviderWait,
  type WaitingProviderStep,
} from "@otomat/db";
import type { StepProviderWait } from "@otomat/domain";

import { emitLedgerEvent } from "#events";

import { resumeRun } from "../commands.js";
import { failureReason } from "../fail-run.js";
import {
  buildProviderResumeEvent,
  type ProviderResumeOutcome,
  type SessionRef,
} from "../markers.js";
import { hasRunActivity, type SupervisorState } from "../state.js";
import { holdsOpenWorkspace, issueWorkspace } from "../workspace.js";

/** Why this due wait cannot be resumed at all any more, or null when it can be attempted. */
function invalidReason(state: SupervisorState, waiting: WaitingProviderStep): string | null {
  return holdsOpenWorkspace(issueWorkspace(state.db, waiting.issue_id), waiting.run_id)
    ? null
    : "This run no longer holds its issue's workspace";
}

function journal(
  state: SupervisorState,
  ref: SessionRef,
  resumeAt: string,
  outcome: ProviderResumeOutcome,
  detail: string,
): void {
  emitLedgerEvent(
    state.db,
    state.dataDir,
    ref.runId,
    buildProviderResumeEvent(ref, resumeAt, outcome, detail, new Date().toISOString()),
  );
}

/** A refused attempt drops its schedule so nothing retries in a tight loop; the step stays waiting, for the operator to reschedule. */
function refuse(
  state: SupervisorState,
  ref: SessionRef & { stepRunId: string },
  wait: StepProviderWait,
  resumeAt: string,
  detail: string,
): void {
  setStepProviderWait(state.db, ref.stepRunId, { ...wait, resume_at: null });
  journal(state, ref, resumeAt, "refused", detail);
}

/**
 * The scheduler's pass: resumes every suspended step whose deadline has come.
 * A step with no schedule is left alone — it is waiting for the operator, not for
 * the clock — and a workspace with a live writer is simply left for the next pass,
 * because one writer per workspace is the rule the resume itself relies on.
 * Answers how many runs it resumed.
 */
export async function resumeDueProviderWaits(state: SupervisorState): Promise<number> {
  const now = new Date().toISOString();
  let resumed = 0;
  for (const waiting of listStepsWaitingForProvider(state.db)) {
    const { step, run_id: runId } = waiting;
    const wait = step.provider_wait_json;
    if (wait === null || wait.resume_at === null || wait.resume_at > now) continue;
    const ref = { runId, stepRunId: step.id, agentSessionId: null };
    const invalid = invalidReason(state, waiting);
    if (invalid !== null) {
      refuse(state, ref, wait, wait.resume_at, invalid);
      continue;
    }
    if (hasRunActivity(state, runId)) continue;
    try {
      await resumeRun(state, runId);
      journal(state, ref, wait.resume_at, "resumed", `${wait.provider} quota window reopened`);
      resumed += 1;
    } catch (error) {
      refuse(state, ref, wait, wait.resume_at, failureReason(error));
    }
  }
  return resumed;
}
