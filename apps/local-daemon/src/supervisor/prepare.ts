import { randomUUID } from "node:crypto";

import {
  getIssue,
  getProject,
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

/** An explicit `project_id` that matches no project row — a caller mistake, not a daemon fault. */
export class ProjectNotFoundError extends Error {
  constructor(projectId: string) {
    super(`project ${projectId} not found`);
    this.name = "ProjectNotFoundError";
  }
}

/** Ad-hoc launches pin their project explicitly; the bootstrapped workspace stays the fallback. */
function resolveProjectId(db: Db, defaultProjectId: string, request: StartRunRequest): string {
  if (!request.project_id) return defaultProjectId;
  if (!getProject(db, request.project_id)) throw new ProjectNotFoundError(request.project_id);
  return request.project_id;
}

function resolveIssueId(db: Db, projectId: string, request: StartRunRequest): string {
  if (request.issue_id) return request.issue_id;
  const issueId = randomUUID();
  const prompt = request.prompt ?? "";
  insertIssue(db, {
    id: issueId,
    project_id: projectId,
    title: firstLine(prompt) || "Local run",
    body: prompt,
    status: issueMachine.transition(issueMachine.initial, "ready"),
    source: "local",
  });
  return issueId;
}

/** Materializes the run/step/session rows, the frozen plan, and the run's isolated worktree in its issue's repository. */
export function prepareRun(state: SupervisorState, request: StartRunRequest): TurnContext {
  const { db, dataDir, defaultProjectId, repositories } = state;
  // Every effective runtime is validated before any row (issue included) is written.
  const defaultRuntime = requireAvailableRuntime(request.runtime);
  const stepRuntimes = resolveStepRuntimes(request, defaultRuntime);

  const issueId = resolveIssueId(db, resolveProjectId(db, defaultProjectId, request), request);
  const issue = getIssue(db, issueId);
  if (!issue) throw new Error(`issue ${issueId} not found`);
  const prompt = request.prompt ?? issue.title;
  // The issue owns the project, the project owns the repository: launches from an issue always land in its repo.
  const binding = repositories.forProject(issue.project_id);

  const runId = randomUUID();
  const branch = runBranchName(runId);
  const plan = freezePlan(request, defaultRuntime, stepRuntimes, prompt);
  const firstStep = firstStepToRun(plan);
  const firstStepRuntime = ensureRuntimeAgent(db, firstStep.agent ?? defaultRuntime);
  ensureRuntimeAgent(db, defaultRuntime);
  const agentSessionId = randomUUID();

  // Acquired before the run row exists so a git failure aborts the launch cleanly (no phantom run).
  const worktree = binding ? binding.service.acquire({ owner: runId, branch }) : null;

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
          repository_id: binding?.repositoryId ?? null,
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
        binding?.service.cleanup(runId);
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
