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

import { FAKE_ADAPTER_ID } from "#runtime";

import { runDir } from "./run-events.js";
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

/** Materializes the run/step/session rows and the frozen plan for a fresh turn, returning its context. */
export function prepareRun(
  db: Db,
  dataDir: string,
  defaultProjectId: string,
  request: StartRunRequest,
): TurnContext {
  const issueId = resolveIssueId(db, defaultProjectId, request);
  const issue = getIssue(db, issueId);
  if (!issue) throw new Error(`issue ${issueId} not found`);
  const prompt = request.prompt ?? issue.title;

  const runId = randomUUID();
  const stepRunId = randomUUID();
  const agentSessionId = randomUUID();
  const plan: RunPlan = {
    version: 1,
    steps: [{ id: stepRunId, name: STEP_NAME, agent: FAKE_ADAPTER_ID, prompt, depends_on: [] }],
  };

  insertRun(db, {
    id: runId,
    issue_id: issueId,
    status: runMachine.initial,
    branch: `otomat/run/${runId.slice(0, 8)}`,
    plan_json: plan,
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

  return { runId, stepRunId, agentSessionId, prompt, runDir: runDir(dataDir, runId) };
}
