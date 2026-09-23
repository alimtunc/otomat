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

import { scheduleNextStep, startAfterLiveTurns } from "./advance.js";
import { withContextBudget } from "./context-budget.js";
import { signalIssueLifecycle } from "./issue-lifecycle.js";
import { requireLaunchable } from "./launch-hold.js";
import { buildPlanRevisedEvent } from "./plan-revision.js";
import { reopenIssue, reopenSettledRun, requireRunRow, requireWorktreePath } from "./resume.js";
import { preflightRuntimeConfig } from "./runtime-preflight.js";
import { ensureRuntimeAgent } from "./runtime-selection.js";
import { hasRunActivity, type SupervisorState } from "./state.js";
import { insertTurn, scheduleTurn } from "./turn-scheduling.js";
import type { AppendStepInput } from "./types.js";
import { requireOpenWorkspace } from "./workspace.js";

function nextStepIndex(state: SupervisorState, runId: string): number {
  const indexes = listStepRunsForRun(state.db, runId).map((step) => step.idx);
  return indexes.length === 0 ? 0 : Math.max(...indexes) + 1;
}

/** An appended step attaches its files from the run's own worktree: that is the tree its work will start from. */
async function freezeAppendedContext(
  state: SupervisorState,
  run: RunRow,
  input: AppendStepInput,
): Promise<ContextSelection> {
  const binding = state.repositories.forRepository(run.repository_id);
  return withContextBudget(
    createContextFreezer({
      db: state.db,
      issue: getIssue(state.db, run.issue_id) ?? null,
      snapshot: binding === null ? null : await diffSnapshotOrNull(binding.service, run.id),
      capturedAt: new Date().toISOString(),
    }),
  )(input.references, input.note, input.reviewComments);
}

/** Settle credits any completed turn with the stamped comments, so the fix must be the next settlement. */
export class ReviewFixBusyError extends Error {
  constructor(runId: string) {
    super(`run ${runId} has a turn in flight; request the fix once it settles`);
    this.name = "ReviewFixBusyError";
  }
}

/** Every refusal happens before any write. */
export async function appendRunStep(
  state: SupervisorState,
  runId: string,
  input: AppendStepInput,
): Promise<RunRow> {
  const { db } = state;
  // Frozen first, so nothing awaits between the plan read below and its rewrite: a concurrent append cannot lose a node.
  const context = await freezeAppendedContext(state, requireRunRow(db, runId, "append"), input);
  requireLaunchable(state);
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
  const worktreePath = requireWorktreePath(state, run);
  preflightRuntimeConfig(runtime, config, worktreePath);

  const step: RunPlanStep = {
    id: randomUUID(),
    name: input.name,
    agent: config.runtime,
    prompt: null,
    context,
    depends_on: [...input.dependsOn],
    replaces: input.replaces,
    config,
  };
  if (input.parallel) step.parallel = true;
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

  if (input.parallel) {
    const reopened = reopenSettledRun(state, requireRunRow(db, runId, "append"));
    scheduleTurn(state, insertTurn(state, reopened, step, worktreePath));
  } else if (hasRunActivity(state, runId)) {
    startAfterLiveTurns(state, runId);
  } else {
    scheduleNextStep(state, reopenSettledRun(state, requireRunRow(db, runId, "append")));
  }
  return requireRunRow(db, runId, "append");
}
