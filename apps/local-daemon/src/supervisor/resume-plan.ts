import {
  getRun,
  getStepRun,
  listAgentSessionsForRun,
  listCompeteGroupsForRun,
  listStepRunsForRun,
  type AgentSessionRow,
  type CompeteGroupRow,
  type Db,
  type RunRow,
  type StepRunRow,
} from "@otomat/db";
import {
  executableSteps,
  isRunPlanCompeteGroup,
  isRunResumable,
  isRunSettled,
  isStepSettled,
  readyPlanWork,
  latestSessionForStep,
  type RunPlanCompetitor,
  type RunPlanStep,
  type ReadyPlanWork,
  type RunResumePlan,
} from "@otomat/domain";

import { resumableRuntime } from "./resume.js";
import { competeGroupStatuses, stepStatuses } from "./settle/context.js";
import { hasRunActivity, type SupervisorState } from "./state.js";
import { holdsOpenWorkspace, issueWorkspace } from "./workspace.js";

type ResumableStep = RunPlanStep | RunPlanCompetitor;

/** What **Resume run** will do, decided once — the route serves it and the command executes it, so the cockpit never announces a mode the daemon then declines. */
export type ResumeAction =
  | {
      kind: "compete_group";
      group: CompeteGroupRow;
      competitors: readonly RunPlanCompetitor[];
    }
  | { kind: "native"; session: AgentSessionRow; step: ResumableStep }
  | { kind: "recovery"; step: ResumableStep; reason: string }
  | { kind: "next_step"; work: ReadyPlanWork }
  | { kind: "unavailable"; reason: string };

function stepOf(run: RunRow, stepRunId: string): ResumableStep | undefined {
  return executableSteps(run.plan_json).find((step) => step.id === stepRunId);
}

/** Native when the provider session survives, a recovery session in the same step otherwise. */
function reopen(db: Db, run: RunRow, step: ResumableStep): ResumeAction {
  const latest = latestSessionForStep(listAgentSessionsForRun(db, run.id), step.id);
  const config =
    getStepRun(db, step.id)?.next_turn_config_json ?? latest?.config_json ?? step.config ?? null;
  const resolvedStep = { ...step, config };
  if (!latest || latest.provider_session_id === null) {
    return {
      kind: "recovery",
      step: resolvedStep,
      reason: "No provider session was recorded for this step",
    };
  }
  if (resumableRuntime(db, run, latest) === null) {
    const reason = "This run's runtime cannot reattach to a provider session";
    return { kind: "recovery", step: resolvedStep, reason };
  }
  return { kind: "native", session: latest, step: resolvedStep };
}

/** The earliest step that stopped without succeeding: a fail-fast cascade cancels everything after the real failure, and recovery starts at the failure. Compete candidates reopen as a group or not at all. */
function stoppedStep(steps: readonly StepRunRow[]): StepRunRow | undefined {
  return steps.find(
    (step) =>
      step.compete_group_id === null && isStepSettled(step.status) && step.status !== "succeeded",
  );
}

function unavailableFor(state: SupervisorState, run: RunRow): ResumeAction | null {
  if (!isRunResumable(run.status)) {
    return { kind: "unavailable", reason: `A ${run.status} run has no turn to resume` };
  }
  if (hasRunActivity(state, run.id)) {
    return { kind: "unavailable", reason: "A turn is already running in this workspace" };
  }
  if (!holdsOpenWorkspace(issueWorkspace(state.db, run.issue_id), run.id)) {
    return { kind: "unavailable", reason: "This run no longer holds its issue's workspace" };
  }
  return null;
}

function interruptedCompeteAction(
  db: Db,
  run: RunRow,
  steps: readonly StepRunRow[],
  group: CompeteGroupRow,
): Extract<ResumeAction, { kind: "compete_group" }> {
  const candidateIds = new Set(
    steps
      .filter((step) => step.compete_group_id === group.id && step.status === "awaiting_human")
      .map((step) => step.id),
  );
  const plannedGroup = run.plan_json.steps.find((node) => node.id === group.id);
  const competitors =
    plannedGroup && isRunPlanCompeteGroup(plannedGroup)
      ? plannedGroup.compete.filter((candidate) => candidateIds.has(candidate.id))
      : [];
  const sessions = listAgentSessionsForRun(db, run.id);
  return {
    kind: "compete_group",
    group,
    competitors: competitors.map((step) => ({
      ...step,
      config:
        getStepRun(db, step.id)?.next_turn_config_json ??
        latestSessionForStep(sessions, step.id)?.config_json ??
        step.config ??
        null,
    })),
  };
}

/** Reads rows only; nothing here writes, so the same call answers the cockpit and drives the command. */
export function resolveResumeAction(state: SupervisorState, run: RunRow): ResumeAction {
  const refusal = unavailableFor(state, run);
  if (refusal) return refusal;

  const { db } = state;
  const steps = listStepRunsForRun(db, run.id);
  const groups = listCompeteGroupsForRun(db, run.id);
  const interruptedGroup = groups.find((group) => group.status === "awaiting_human");
  if (interruptedGroup) return interruptedCompeteAction(db, run, steps, interruptedGroup);

  const interrupted = steps.find(
    (step) => step.status === "awaiting_human" || step.status === "waiting_for_provider",
  );
  const target = interrupted ? stepOf(run, interrupted.id) : undefined;
  if (target) return reopen(db, run, target);

  // A stopped run reopens its own unfinished work first; a paused one owes the plan its next node.
  if (isRunSettled(run.status)) {
    const stopped = stoppedStep(steps);
    const node = stopped ? stepOf(run, stopped.id) : undefined;
    if (!stopped || !node) {
      return { kind: "unavailable", reason: "This run has no stopped step left to reopen" };
    }
    return reopen(db, run, node);
  }
  const ready = readyPlanWork(run.plan_json, stepStatuses(steps), competeGroupStatuses(groups));
  if (ready) return { kind: "next_step", work: ready };
  const last = executableSteps(run.plan_json).at(-1);
  if (!last) return { kind: "unavailable", reason: "This run's plan has no step to resume" };
  return reopen(db, run, last);
}

function toResumePlan(action: ResumeAction): RunResumePlan {
  if (action.kind === "unavailable") return { mode: "unavailable", reason: action.reason };
  if (action.kind === "recovery") return { mode: "recovery", reason: action.reason };
  if (action.kind === "next_step") {
    const name = action.work.kind === "step" ? action.work.step.name : action.work.group.name;
    return { mode: "next_step", step_name: name };
  }
  return { mode: "native" };
}

/** Wire answer for a run the cockpit is showing; an unknown run resumes nothing. */
export function runResumePlan(state: SupervisorState, runId: string): RunResumePlan {
  const run = getRun(state.db, runId);
  if (!run) return { mode: "unavailable", reason: "This run no longer exists" };
  return toResumePlan(resolveResumeAction(state, run));
}
