import { randomUUID } from "node:crypto";

import {
  adoptPreparedWorkspace,
  preparedWorkspace,
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
  availableBranchName,
  GitCommandError,
  WorktreeConflictError,
  type AcquireWorktreeInput,
  type GitWorktreeService,
  type WorktreeRecord,
} from "#git";
import { toRecord } from "#git/record";
import { serializeByKey } from "#serialize";

import { issueBranchName } from "./branch-name.js";
import { withContextBudget } from "./context-budget.js";
import {
  freezePlan,
  resolvePlanConfigs,
  runDefaultConfig,
  runDefaultOverrides,
} from "./freeze-plan.js";
import { requireLaunchable } from "./launch-hold.js";
import { LaunchRefusedError, resolveLaunchTarget } from "./launch-target.js";
import { preflightRunPlan } from "./runtime-preflight.js";
import { ensureRuntimeAgent } from "./runtime-selection.js";
import type { SupervisorState } from "./state.js";
import { freezeSupervision } from "./supervision/freeze.js";

interface LaunchIssue {
  row: ContextIssueRow;
  /** Set only when the launch owns the issue: a prompt-only run creates the one it works on. */
  create: LocalIssue | null;
}

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
    title: prompt.split("\n")[0]?.trim().slice(0, 120) || "Local run",
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

export async function prepareRun(
  state: SupervisorState,
  request: StartRunRequest,
): Promise<string> {
  const issueProject = request.issue_id ? getIssue(state.db, request.issue_id)?.project_id : null;
  const project = issueProject ?? request.project_id ?? state.defaultProjectId;
  return serializeByKey(state.launchesByProject, project, () => prepareLaunch(state, request));
}

async function prepareLaunch(state: SupervisorState, request: StartRunRequest): Promise<string> {
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
  const supervision = freezeSupervision(db, request);
  for (const runtime of [...runtimes, supervision?.config.runtime]) {
    if (runtime !== undefined) ensureRuntimeAgent(db, runtime);
  }

  const runId = randomUUID();
  const { projectId, binding, baseRef, baseSha } = await resolveLaunchTarget(
    state,
    request,
    existingIssue,
  );
  const issue = launchIssue(projectId, request, existingIssue);
  const prepared = preparedWorkspace(db, issue.row.id);
  const branch =
    prepared?.branch ??
    (await availableBranchName(
      binding.rootPath,
      issueBranchName(issue.row, runId),
      runId.slice(0, 8),
    ));

  const plan = await freezePlan(
    request,
    defaultConfig,
    configFor,
    withContextBudget(
      createContextFreezer({
        db,
        issue: issue.row,
        snapshot: prepared?.owner_token
          ? await binding.service.worktreeTree(prepared.owner_token)
          : await binding.service.treeSnapshot(baseSha),
        capturedAt: new Date().toISOString(),
      }),
    ),
  );

  const worktree = prepared
    ? toRecord(prepared)
    : await acquireRunWorktree(binding.service, {
        owner: runId,
        branch,
        baseRef,
        baseSha,
      });

  try {
    // The hold counts runs by their rows, and this one has none until the insert below.
    requireLaunchable(state);
    preflightRunPlan(plan, worktree.path);
    db.transaction(
      () => {
        if (issue.create) insertIssue(db, issue.create);
        if (prepared) {
          if (preparedWorkspace(db, issue.row.id)?.id !== prepared.id)
            throw new WorktreeConflictError("The prepared workspace changed during launch.");
          adoptPreparedWorkspace(db, issue.row.id, runId);
        }
        insertRun(db, {
          id: runId,
          issue_id: issue.row.id,
          agent_id: defaultRuntime,
          status: runMachine.initial,
          branch,
          plan_json: plan,
          supervision_json: supervision,
          repository_id: binding.repositoryId,
          worktree_id: worktree.id,
        });
        insertPlanRows(db, runId, plan);
      },
      { behavior: "immediate" },
    );
  } catch (error) {
    try {
      if (!prepared) await binding.service.cleanup(runId);
    } catch (cleanupError) {
      console.error(`[otomat] worktree rollback for aborted run ${runId} failed`, cleanupError);
    }
    throw error;
  }

  return runId;
}

function isSystemError(error: unknown): boolean {
  return error instanceof Error && "syscall" in error && typeof error.syscall === "string";
}

async function acquireRunWorktree(
  service: GitWorktreeService,
  input: AcquireWorktreeInput,
): Promise<WorktreeRecord> {
  try {
    return await service.acquire(input);
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
