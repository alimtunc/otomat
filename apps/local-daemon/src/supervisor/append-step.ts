import { randomUUID } from "node:crypto";

import {
  getIssue,
  insertStepRun,
  listStepRunsForRun,
  updateRunPlan,
  type RunRow,
} from "@otomat/db";
import {
  appendPlanStep,
  overrideLevel,
  stepRunMachine,
  type ContextSelection,
  type RunPlanStep,
} from "@otomat/domain";

import { resolveAgentConfig } from "#agents";
import { createContextFreezer } from "#context";
import { emitLedgerEvent } from "#events";
import { diffSnapshotOrNull } from "#git";

import { scheduleNextStep } from "./advance.js";
import { signalIssueLifecycle } from "./issue-lifecycle.js";
import { buildPlanRevisedEvent } from "./plan-revision.js";
import { reopenIssue, reopenSettledRun, requireRunRow, requireWorktreePath } from "./resume.js";
import { preflightRuntimeConfig } from "./runtime-preflight.js";
import { ensureRuntimeAgent } from "./runtime-selection.js";
import { hasRunActivity, type SupervisorState } from "./state.js";
import type { AppendStepInput } from "./types.js";
import { requireOpenWorkspace } from "./workspace.js";

function nextStepIndex(state: SupervisorState, runId: string): number {
  const indexes = listStepRunsForRun(state.db, runId).map((step) => step.idx);
  return indexes.length === 0 ? 0 : Math.max(...indexes) + 1;
}

/** An appended step attaches its files from the run's own worktree: that is the tree its work will start from. */
function freezeAppendedContext(
  state: SupervisorState,
  run: RunRow,
  input: AppendStepInput,
): ContextSelection {
  const binding = state.repositories.forRepository(run.repository_id);
  return createContextFreezer({
    db: state.db,
    issue: getIssue(state.db, run.issue_id) ?? null,
    snapshot: binding === null ? null : diffSnapshotOrNull(binding.service, run.id),
    capturedAt: new Date().toISOString(),
  })(input.references, input.note, input.reviewComments);
}

/** Settle credits any completed turn with the stamped comments, so the fix must be the next settlement. */
export class ReviewFixBusyError extends Error {
  constructor(runId: string) {
    super(`run ${runId} has a turn in flight; request the fix once it settles`);
    this.name = "ReviewFixBusyError";
  }
}

/**
 * Appends a step to a launched run and starts it when the workspace is free.
 *
 * Every refusal happens before any write: the run must still hold its issue's
 * workspace (only a merge or an abandon closes it), the issue must accept
 * running again — a merged issue is `done`, and the issue machine is what says
 * no — and the agent config must resolve. The step then runs in the run's own
 * worktree, against the same history, with its own step/session rows and
 * conversation. A stopped cycle is reopened for it; while a turn is in flight
 * the step stays `queued` and the post-turn chain starts it, so nothing ever
 * runs twice in one worktree.
 */
export async function appendRunStep(
  state: SupervisorState,
  runId: string,
  input: AppendStepInput,
): Promise<RunRow> {
  const { db } = state;
  const run = requireRunRow(db, runId, "append");
  requireOpenWorkspace(db, run);
  if (input.origin === "review_fix" && hasRunActivity(state, runId)) {
    throw new ReviewFixBusyError(runId);
  }

  const config = resolveAgentConfig(db, input.selector, {
    levels: [overrideLevel("step", input.overrides)],
    runtimeSource: "step",
  });
  const runtime = ensureRuntimeAgent(db, config.runtime);
  preflightRuntimeConfig(runtime, config, requireWorktreePath(state, run));

  const step: RunPlanStep = {
    id: randomUUID(),
    name: input.name,
    agent: config.runtime,
    prompt: null,
    context: freezeAppendedContext(state, run, input),
    depends_on: [...input.dependsOn],
    replaces: input.replaces,
    config,
  };
  const plan = appendPlanStep(run.plan_json, step);
  const idx = nextStepIndex(state, runId);

  const issue = reopenIssue(db, run);

  db.transaction(
    () => {
      updateRunPlan(db, runId, plan);
      insertStepRun(db, {
        id: step.id,
        run_id: runId,
        idx,
        name: step.name,
        status: stepRunMachine.initial,
      });
    },
    { behavior: "immediate" },
  );
  emitLedgerEvent(
    db,
    state.dataDir,
    runId,
    buildPlanRevisedEvent(runId, step, config, input.origin, new Date().toISOString()),
  );
  if (issue) signalIssueLifecycle(state.syncIssueLifecycle, issue.id, "in_progress", runId);

  if (!hasRunActivity(state, runId)) {
    scheduleNextStep(state, reopenSettledRun(state, requireRunRow(db, runId, "append")));
  }
  return requireRunRow(db, runId, "append");
}
