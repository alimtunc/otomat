import { randomUUID } from "node:crypto";

import {
  getIssue,
  getProject,
  insertCompeteGroup,
  insertIssue,
  insertRun,
  insertStepRun,
  type Db,
} from "@otomat/db";
import {
  competeGroupMachine,
  executableSteps,
  isRunPlanCompeteGroup,
  issueMachine,
  runMachine,
  stepRunMachine,
  type StartRunRequest,
} from "@otomat/domain";

import { freezePlan, resolveStepRuntimes } from "./freeze-plan.js";
import { ensureRuntimeAgent, requireAvailableRuntime } from "./runtime-selection.js";
import type { SupervisorState } from "./state.js";

const RUN_BRANCH_PREFIX = "otomat/run/";

/** 8 hex chars of the run UUID: readable branch names with a negligible per-repo collision surface. */
function runBranchName(runId: string): string {
  return `${RUN_BRANCH_PREFIX}${runId.slice(0, 8)}`;
}

function firstLine(text: string): string {
  const [first = ""] = text.split("\n");
  return first.trim().slice(0, 120);
}

/** An explicit project id that matches no row: a caller error, not a daemon failure. */
export class ProjectNotFoundError extends Error {
  constructor(projectId: string) {
    super(`project ${projectId} not found`);
    this.name = "ProjectNotFoundError";
  }
}

/** Compete candidates require isolated Git worktrees and cannot run in a repository-less project. */
export class CompeteRepositoryRequiredError extends Error {
  constructor(projectId: string) {
    super(`project ${projectId} needs a usable Git repository for compete groups`);
    this.name = "CompeteRepositoryRequiredError";
  }
}

/** Ad-hoc launches pin an explicit valid project; otherwise they use the boot workspace. */
function resolveProjectId(db: Db, defaultProjectId: string, request: StartRunRequest): string {
  if (!request.project_id) return defaultProjectId;
  if (!getProject(db, request.project_id)) throw new ProjectNotFoundError(request.project_id);
  return request.project_id;
}

/** Creates the issue that anchors a prompt-only launch and returns its id. */
function insertAdHocIssue(db: Db, projectId: string, request: StartRunRequest): string {
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

/**
 * Materializes the run, step and session rows, freezes the plan, and acquires an
 * isolated worktree from the repository belonging to the run's issue.
 */
export function prepareRun(state: SupervisorState, request: StartRunRequest): string {
  const { db, defaultProjectId, repositories } = state;
  // Every effective runtime is validated before any row (issue included) is written.
  const defaultRuntime = requireAvailableRuntime(request.runtime);
  const stepRuntimes = resolveStepRuntimes(request, defaultRuntime);

  const existingIssue = request.issue_id ? getIssue(db, request.issue_id) : undefined;
  if (request.issue_id && !existingIssue) throw new Error(`issue ${request.issue_id} not found`);
  const projectId = existingIssue?.project_id ?? resolveProjectId(db, defaultProjectId, request);
  const prompt = request.prompt ?? existingIssue?.title ?? "";
  // The issue owns the project, so issue-based launches always resolve that project's repository.
  const binding = repositories.forProject(projectId);

  const runId = randomUUID();
  const branch = runBranchName(runId);
  const plan = freezePlan(request, defaultRuntime, stepRuntimes, prompt);
  if (plan.steps.some(isRunPlanCompeteGroup) && !binding) {
    throw new CompeteRepositoryRequiredError(projectId);
  }
  for (const step of executableSteps(plan)) ensureRuntimeAgent(db, step.agent ?? defaultRuntime);
  ensureRuntimeAgent(db, defaultRuntime);
  const issueId = existingIssue?.id ?? insertAdHocIssue(db, projectId, request);

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
        let executableIndex = 0;
        plan.steps.forEach((node, nodeIndex) => {
          if (isRunPlanCompeteGroup(node)) {
            insertCompeteGroup(db, {
              id: node.id,
              run_id: runId,
              idx: nodeIndex,
              name: node.name,
              status: competeGroupMachine.initial,
            });
            for (const competitor of node.compete) {
              insertStepRun(db, {
                id: competitor.id,
                run_id: runId,
                idx: executableIndex++,
                name: competitor.name,
                status: stepRunMachine.initial,
                compete_group_id: node.id,
              });
            }
            return;
          }
          insertStepRun(db, {
            id: node.id,
            run_id: runId,
            idx: executableIndex++,
            name: node.name,
            status: stepRunMachine.initial,
          });
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

  return runId;
}
