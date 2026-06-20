import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { toRun } from "@otomat/api";
import {
  getIssue,
  getRun,
  insertAgentSession,
  insertIssue,
  insertRun,
  insertStepRun,
  updateAgentSessionStatus,
  updateRunStatus,
  updateStepRunStatus,
  type Db,
} from "@otomat/db";
import {
  agentSessionMachine,
  runMachine,
  stepRunMachine,
  type AgentSessionState,
  type RunContract,
  type RunPlan,
  type RunState,
  type StartRunRequest,
  type StepRunState,
} from "@otomat/domain";
import { EventTailer } from "@otomat/events";
import {
  FAKE_ADAPTER_ID,
  FakeRuntimeAdapter,
  MemorySink,
  type RuntimeFinalStatus,
} from "@otomat/runtime";

export interface RunLauncherConfig {
  db: Db;
  /** Root under which each run gets a `runs/<id>/events.jsonl` artifact directory. */
  dataDir: string;
  defaultProjectId: string;
}

export interface RunLauncher {
  launchRun(request: StartRunRequest): Promise<RunContract>;
  /** Resolves once every in-flight run has reached a terminal state (shutdown/test aid). */
  settle(): Promise<void>;
}

interface ExecuteContext {
  runId: string;
  stepRunId: string;
  sessionId: string;
  prompt: string;
}

const STEP_NAME = "Agent turn";

export function createRunLauncher(config: RunLauncherConfig): RunLauncher {
  const { db, dataDir, defaultProjectId } = config;
  const adapter = new FakeRuntimeAdapter();
  const pending = new Set<Promise<void>>();

  function advanceRun(
    runId: string,
    from: RunState,
    to: RunState,
    timestamps: { started_at?: string; completed_at?: string } = {},
  ): void {
    updateRunStatus(db, runId, { status: runMachine.transition(from, to), ...timestamps });
  }

  function advanceStep(stepRunId: string, from: StepRunState, to: StepRunState): void {
    updateStepRunStatus(db, stepRunId, stepRunMachine.transition(from, to));
  }

  function advanceSession(sessionId: string, from: AgentSessionState, to: AgentSessionState): void {
    updateAgentSessionStatus(db, sessionId, agentSessionMachine.transition(from, to));
  }

  function resolveIssueId(request: StartRunRequest): string {
    if (request.issue_id) return request.issue_id;
    const issueId = randomUUID();
    const prompt = request.prompt ?? "";
    insertIssue(db, {
      id: issueId,
      project_id: defaultProjectId,
      title: firstLine(prompt) || "Local run",
      body: prompt,
      status: "ready",
      source: "local",
    });
    return issueId;
  }

  function finalize(ctx: ExecuteContext, status: RuntimeFinalStatus): void {
    const completedAt = new Date().toISOString();
    if (status === "completed") {
      advanceRun(ctx.runId, "running", "review_ready");
      advanceRun(ctx.runId, "review_ready", "completed", { completed_at: completedAt });
      advanceStep(ctx.stepRunId, "running", "succeeded");
      advanceSession(ctx.sessionId, "active", "terminated");
      return;
    }
    if (status === "canceled") {
      advanceRun(ctx.runId, "running", "canceled", { completed_at: completedAt });
      advanceStep(ctx.stepRunId, "running", "canceled");
      advanceSession(ctx.sessionId, "active", "terminated");
      return;
    }
    advanceRun(ctx.runId, "running", "failed", { completed_at: completedAt });
    advanceStep(ctx.stepRunId, "running", "failed");
    advanceSession(ctx.sessionId, "active", "failed");
  }

  async function execute(ctx: ExecuteContext): Promise<void> {
    const runDir = join(dataDir, "runs", ctx.runId);
    let status: RuntimeFinalStatus = "failed";
    try {
      const final = await adapter.run(
        {
          run_id: ctx.runId,
          step_run_id: ctx.stepRunId,
          agent_session_id: ctx.sessionId,
          prompt: ctx.prompt,
          run_dir: runDir,
        },
        new MemorySink(),
        new AbortController().signal,
      );
      status = final.status;
    } catch (error) {
      console.error(`[otomat] run ${ctx.runId} adapter failed`, error);
      status = "failed";
    }

    try {
      new EventTailer({ db, runId: ctx.runId, filePath: join(runDir, "events.jsonl") }).drain();
    } catch (error) {
      // Best-effort: a ledger ingest failure must never crash the daemon.
      console.error(`[otomat] run ${ctx.runId} ledger ingest failed`, error);
    }

    try {
      finalize(ctx, status);
    } catch (error) {
      // Best-effort: a finalize failure must never crash the daemon or reject settle().
      console.error(`[otomat] run ${ctx.runId} finalize failed`, error);
    }
  }

  async function launchRun(request: StartRunRequest): Promise<RunContract> {
    const issueId = resolveIssueId(request);
    const issue = getIssue(db, issueId);
    if (!issue) throw new Error(`issue ${issueId} not found`);
    const prompt = request.prompt ?? issue.title;

    const runId = randomUUID();
    const stepRunId = randomUUID();
    const sessionId = randomUUID();
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
      id: sessionId,
      step_run_id: stepRunId,
      status: agentSessionMachine.initial,
    });

    advanceRun(runId, runMachine.initial, "preparing");
    advanceRun(runId, "preparing", "running", { started_at: new Date().toISOString() });
    advanceStep(stepRunId, stepRunMachine.initial, "starting");
    advanceStep(stepRunId, "starting", "running");
    advanceSession(sessionId, agentSessionMachine.initial, "active");

    const task = execute({ runId, stepRunId, sessionId, prompt }).finally(() => {
      pending.delete(task);
    });
    pending.add(task);

    const row = getRun(db, runId);
    if (!row) throw new Error("run vanished immediately after insert");
    return toRun(row);
  }

  return {
    launchRun,
    settle: async () => {
      await Promise.all(pending);
    },
  };
}

function firstLine(text: string): string {
  const [first = ""] = text.split("\n");
  return first.trim().slice(0, 120);
}
