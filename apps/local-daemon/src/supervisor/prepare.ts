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
  type RunPlan,
  type StartRunRequest,
} from "@otomat/domain";

import { runDir } from "#events";

import { ensureRuntimeAgent } from "./runtime-selection.js";
import type { SupervisorState } from "./state.js";
import type { TurnContext } from "./types.js";

const STEP_NAME = "Agent turn";

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
  const runtime = ensureRuntimeAgent(db, request.runtime);
  const issueId = resolveIssueId(db, defaultProjectId, request);
  const issue = getIssue(db, issueId);
  if (!issue) throw new Error(`issue ${issueId} not found`);
  const prompt = request.prompt ?? issue.title;

  const runId = randomUUID();
  const stepRunId = randomUUID();
  const agentSessionId = randomUUID();
  const branch = `otomat/run/${runId.slice(0, 8)}`;
  const plan: RunPlan = {
    version: 1,
    steps: [{ id: stepRunId, name: STEP_NAME, agent: runtime, prompt, depends_on: [] }],
  };

  // Acquired before the run row exists so a git failure aborts the launch cleanly (no phantom run).
  const worktree = worktrees ? worktrees.service.acquire({ owner: runId, branch }) : null;

  try {
    insertRun(db, {
      id: runId,
      issue_id: issueId,
      agent_id: runtime,
      status: runMachine.initial,
      branch,
      plan_json: plan,
      repository_id: worktrees?.repositoryId ?? null,
      worktree_id: worktree?.id ?? null,
    });
    insertStepRun(db, {
      id: stepRunId,
      run_id: runId,
      idx: 0,
      name: STEP_NAME,
      status: stepRunMachine.initial,
    });
    insertAgentSession(db, {
      id: agentSessionId,
      step_run_id: stepRunId,
      status: agentSessionMachine.initial,
    });
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
    stepRunId,
    agentSessionId,
    prompt,
    runDir: runDir(dataDir, runId),
    worktreePath: worktree?.path ?? null,
    runtime,
  };
}
