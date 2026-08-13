import { randomUUID } from "node:crypto";

import {
  getIssue,
  insertCompeteGroup,
  insertIssue,
  insertRun,
  insertStepRun,
  readExecutionDefaults,
  type Db,
  type IssueRow,
  type LocalIssue,
} from "@otomat/db";
import {
  competeGroupMachine,
  isRunPlanCompeteGroup,
  issueMachine,
  runMachine,
  stepRunMachine,
  type RunPlan,
  type StartRunRequest,
} from "@otomat/domain";

import { resolveAgentConfig } from "#agents";
import { createContextFreezer, type ContextIssueRow } from "#context";
import {
  GitCommandError,
  WorktreeConflictError,
  type AcquireWorktreeInput,
  type GitWorktreeService,
  type WorktreeRecord,
} from "#git";

import {
  freezePlan,
  resolvePlanConfigs,
  runDefaultConfig,
  runDefaultOverrides,
} from "./freeze-plan.js";
import { LaunchRefusedError, resolveLaunchTarget } from "./launch-target.js";
import { ensureRuntimeAgent } from "./runtime-selection.js";
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

interface LaunchIssue {
  row: ContextIssueRow;
  /** Set only when the launch owns the issue: a prompt-only run creates the one it works on. */
  create: LocalIssue | null;
}

/** The issue a run works on, resolved before the transaction so the plan can freeze it as its context. */
function launchIssue(
  projectId: string,
  request: StartRunRequest,
  existing: IssueRow | undefined,
): LaunchIssue {
  if (existing) return { row: existing, create: null };
  const prompt = request.prompt ?? "";
  const created = {
    id: randomUUID(),
    project_id: projectId,
    title: firstLine(prompt) || "Local run",
    body: prompt,
    status: issueMachine.transition(issueMachine.initial, "ready"),
    source: "local",
    source_identifier: null,
    source_state_name: null,
    source_labels: null,
    source_assignee_name: null,
    source_priority: null,
  } as const satisfies LocalIssue & ContextIssueRow;
  return { row: created, create: created };
}

function insertPlanRows(db: Db, runId: string, plan: RunPlan): void {
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
}

/** A launched run always owns a worktree: every precondition refuses before any row is written. */
export function prepareRun(state: SupervisorState, request: StartRunRequest): string {
  const { db } = state;
  const runDefault = runDefaultConfig(request, readExecutionDefaults(db).runtime);
  const defaultConfig = resolveAgentConfig(
    db,
    runDefault.selector,
    runDefaultOverrides(runDefault),
  );
  const defaultRuntime = defaultConfig.runtime;

  const existingIssue = request.issue_id ? getIssue(db, request.issue_id) : undefined;
  if (request.issue_id && !existingIssue) throw new Error(`issue ${request.issue_id} not found`);

  // Agents are resolved and refused before the repository is touched: an unavailable runtime is the caller's to fix, whatever the worktree says.
  const { configFor, runtimes } = resolvePlanConfigs(db, request, runDefault, defaultConfig);
  for (const runtime of runtimes) ensureRuntimeAgent(db, runtime);

  const runId = randomUUID();
  const branch = runBranchName(runId);
  const { projectId, binding, baseRef } = resolveLaunchTarget(state, request, existingIssue);
  const issue = launchIssue(projectId, request, existingIssue);

  // The plan freezes attached files from the base tree: the run's own worktree does not exist yet.
  const plan = freezePlan(
    request,
    defaultConfig,
    configFor,
    createContextFreezer({
      db,
      issue: issue.row,
      snapshot: binding.service.treeSnapshot(baseRef),
      capturedAt: new Date().toISOString(),
    }),
  );

  const worktree = acquireRunWorktree(binding.service, { owner: runId, branch, baseRef });

  try {
    db.transaction(
      () => {
        if (issue.create) insertIssue(db, issue.create);
        insertRun(db, {
          id: runId,
          issue_id: issue.row.id,
          agent_id: defaultRuntime,
          status: runMachine.initial,
          branch,
          plan_json: plan,
          repository_id: binding.repositoryId,
          worktree_id: worktree.id,
        });
        insertPlanRows(db, runId, plan);
      },
      { behavior: "immediate" },
    );
  } catch (error) {
    try {
      binding.service.cleanup(runId);
    } catch (cleanupError) {
      console.error(`[otomat] worktree rollback for aborted run ${runId} failed`, cleanupError);
    }
    throw error;
  }

  return runId;
}

/** Node reports an unwritable or full data dir with a `syscall`; the launch cannot proceed, but the daemon is not broken. */
function isSystemError(error: unknown): boolean {
  return error instanceof Error && "syscall" in error && typeof error.syscall === "string";
}

/**
 * Turns an acquire failure the user can act on — git refused, the branch is
 * taken, the worktrees dir is unwritable — into a typed launch refusal carrying
 * the reason. Anything else is a daemon bug and keeps its own stack rather than
 * being reported as a repository the caller should go repair.
 */
function acquireRunWorktree(
  service: GitWorktreeService,
  input: AcquireWorktreeInput,
): WorktreeRecord {
  try {
    return service.acquire(input);
  } catch (error) {
    const actionable =
      error instanceof GitCommandError ||
      error instanceof WorktreeConflictError ||
      isSystemError(error);
    if (!actionable) throw error;
    throw new LaunchRefusedError(
      "worktree_unavailable",
      `could not create the run's worktree: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}
