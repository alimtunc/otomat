import { randomUUID } from "node:crypto";

import {
  getIssue,
  insertAgentSession,
  insertIssue,
  insertRun,
  insertStepRun,
  type Db,
} from "@otomat/db";
import {
  agentSessionMachine,
  issueMachine,
  runMachine,
  stepRunMachine,
  type StartRunRequest,
} from "@otomat/domain";

import { runDir } from "#events";

import { firstStepToRun, freezePlan, resolveStepRuntimes } from "./freeze-plan.js";
import { ensureRuntimeAgent, requireAvailableRuntime } from "./runtime-selection.js";
import type { SupervisorState } from "./state.js";
import type { TurnContext } from "./types.js";

const RUN_BRANCH_PREFIX = "otomat/run/";

/** 8 hex chars of the run UUID: readable branch names with a negligible per-repo collision surface. */
function runBranchName(runId: string): string {
  return `${RUN_BRANCH_PREFIX}${runId.slice(0, 8)}`;
}

function firstLine(text: string): string {
  const [first = ""] = text.split("\n");
  return first.trim().slice(0, 120);
}

function resolveIssueId(db: Db, defaultProjectId: string, request: StartRunRequest): string {
  if (request.issue_id) return request.issue_id;
  const issueId = randomUUID();
  const prompt = request.prompt ?? "";
  insertIssue(db, {
    id: issueId,
    project_id: defaultProjectId,
    title: firstLine(prompt) || "Local run",
    body: prompt,
    status: issueMachine.transition(issueMachine.initial, "ready"),
    source: "local",
  });
  return issueId;
}

/** Materializes the run/step/session rows, the frozen plan, and the run's isolated worktree. */
export function prepareRun(state: SupervisorState, request: StartRunRequest): TurnContext {
  const { db, dataDir, defaultProjectId, worktrees } = state;
  // Every effective runtime is validated before any row (issue included) is written.
  const defaultRuntime = requireAvailableRuntime(request.runtime);
  const stepRuntimes = resolveStepRuntimes(request, defaultRuntime);

  const issueId = resolveIssueId(db, defaultProjectId, request);
  const issue = getIssue(db, issueId);
  if (!issue) throw new Error(`issue ${issueId} not found`);
  const prompt = request.prompt ?? issue.title;

  const runId = randomUUID();
  const branch = runBranchName(runId);
  const plan = freezePlan(request, defaultRuntime, stepRuntimes, prompt);
  const firstStep = firstStepToRun(plan);
  const firstStepRuntime = ensureRuntimeAgent(db, firstStep.agent ?? defaultRuntime);
  ensureRuntimeAgent(db, defaultRuntime);
  const agentSessionId = randomUUID();

  // Acquired before the run row exists so a git failure aborts the launch cleanly (no phantom run).
  const worktree = worktrees ? worktrees.service.acquire({ owner: runId, branch }) : null;

  try {
    db.transaction(
      () => {
        insertRun(db, {
          id: runId,
          issue_id: issueId,
          agent_id: defaultRuntime,
          status: runMachine.initial,
          branch,
          plan_json: plan,
          repository_id: worktrees?.repositoryId ?? null,
          worktree_id: worktree?.id ?? null,
        });
        plan.steps.forEach((step, index) => {
          insertStepRun(db, {
            id: step.id,
            run_id: runId,
            idx: index,
            name: step.name,
            status: stepRunMachine.initial,
          });
        });
        insertAgentSession(db, {
          id: agentSessionId,
          step_run_id: firstStep.id,
          agent_id: firstStepRuntime,
          status: agentSessionMachine.initial,
        });
      },
      { behavior: "immediate" },
    );
  } catch (error) {
    // The rows never landed — roll back the worktree acquired above so no orphan dir/branch leaks.
    if (worktree) {
      try {
        worktrees?.service.cleanup(runId);
      } catch (cleanupError) {
        console.error(`[otomat] worktree rollback for aborted run ${runId} failed`, cleanupError);
      }
    }
    throw error;
  }

  return {
    runId,
    stepRunId: firstStep.id,
    agentSessionId,
    prompt: firstStep.prompt ?? prompt,
    runDir: runDir(dataDir, runId),
    worktreePath: worktree?.path ?? null,
    runtime: firstStepRuntime,
  };
}
