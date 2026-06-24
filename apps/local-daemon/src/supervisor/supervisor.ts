import { randomUUID } from "node:crypto";
import { join } from "node:path";

import {
  getIssue,
  getRun,
  insertAgentSession,
  insertIssue,
  insertRun,
  insertStepRun,
  listAgentSessionsForRun,
  listStepRunsForRun,
  recordAgentSessionProcess,
  updateRunStatus,
  type AgentSessionRow,
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

import { toRun } from "#api";
import { EventTailer, readRunEvents } from "#events";
import { FAKE_ADAPTER_ID } from "#runtime";

import { buildTerminalMarker, emitLedgerEvent, findFinalStatus } from "./marker.js";
import { reconcileRuns, settleRun } from "./reconcile.js";
import { Semaphore } from "./semaphore.js";
import { driveRunTo, driveSessionTo, driveStepTo } from "./transitions.js";
import {
  DEFAULT_CONCURRENCY,
  type ProcessExit,
  type ReconcileReport,
  type SessionProcess,
  type Supervisor,
  type SupervisorConfig,
} from "./types.js";

const STEP_NAME = "Agent turn";
/** Grace between a graceful `SIGTERM` and a forced `SIGKILL` during abort. */
const ABORT_GRACE_MS = 2000;

function nowIso(): string {
  return new Date().toISOString();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref();
  });
}

interface TurnContext {
  runId: string;
  stepRunId: string;
  agentSessionId: string;
  prompt: string;
  runDir: string;
}

interface InflightProcess {
  proc: SessionProcess;
  monitor: Promise<void>;
}

export function createSupervisor(config: SupervisorConfig): Supervisor {
  const { db, dataDir, defaultProjectId, spawn } = config;
  const slots = new Semaphore(config.concurrency ?? DEFAULT_CONCURRENCY);
  const inflight = new Map<string, InflightProcess>();
  // Runs whose abort owns the settle, so the exit monitor does not race a second finalize.
  const aborting = new Set<string>();
  // Runs reserved for spawn between the synchronous guard and `inflight.set`, so two
  // concurrent start/resume calls for the same run can't both pass the guard and double-spawn.
  const claiming = new Set<string>();

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

  function prepareRun(request: StartRunRequest): TurnContext {
    const issueId = resolveIssueId(request);
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

    return { runId, stepRunId, agentSessionId, prompt, runDir: join(dataDir, "runs", runId) };
  }

  function advanceToRunning(ctx: TurnContext): void {
    const now = nowIso();
    const run = getRun(db, ctx.runId);
    if (!run) throw new Error(`run ${ctx.runId} vanished before spawn`);
    driveRunTo(db, ctx.runId, run.status as RunState, "running", now);
    if (!run.started_at) updateRunStatus(db, ctx.runId, { status: "running", started_at: now });

    for (const step of listStepRunsForRun(db, ctx.runId)) {
      const state = step.status as StepRunState;
      if (!stepRunMachine.isTerminal(state)) driveStepTo(db, step.id, state, "running");
    }
    for (const session of listAgentSessionsForRun(db, ctx.runId)) {
      const state = session.status as AgentSessionState;
      if (!agentSessionMachine.isTerminal(state)) driveSessionTo(db, session.id, state, "active");
    }
  }

  function onExit(ctx: TurnContext, exit: ProcessExit): void {
    if (aborting.has(ctx.runId)) return;
    const run = getRun(db, ctx.runId);
    if (!run) return;
    try {
      settleRun(db, dataDir, run, {
        emitReconciled: false,
        probeLiveness: false,
        observedExit: exit,
        now: nowIso(),
      });
    } catch (error) {
      console.error(`[otomat] run ${ctx.runId} settle failed`, error);
    }
  }

  async function spawnTurn(
    ctx: TurnContext,
    mode: "run" | "resume",
    providerSessionId: string | null,
  ): Promise<void> {
    if (claiming.has(ctx.runId) || inflight.has(ctx.runId)) {
      throw new Error(`run ${ctx.runId} is already starting`);
    }
    claiming.add(ctx.runId);
    await slots.acquire();
    let released = false;
    const release = (): void => {
      if (released) return;
      released = true;
      slots.release();
    };

    try {
      // A slot can take a while to free; an abort/cancel may have landed meanwhile.
      // Never spawn a worker for a run that is no longer in flight.
      const current = getRun(db, ctx.runId);
      if (
        !current ||
        runMachine.isTerminal(current.status as RunState) ||
        aborting.has(ctx.runId)
      ) {
        release();
        return;
      }

      advanceToRunning(ctx);
      const proc = spawn({
        runId: ctx.runId,
        stepRunId: ctx.stepRunId,
        agentSessionId: ctx.agentSessionId,
        prompt: ctx.prompt,
        runDir: ctx.runDir,
        mode,
        providerSessionId,
      });
      const now = nowIso();
      recordAgentSessionProcess(db, ctx.agentSessionId, {
        pid: proc.pid,
        pgid: proc.pgid,
        started_at: now,
        last_seen: now,
      });

      const monitor = proc.exited
        .then((exit) => onExit(ctx, exit))
        .catch((error) => console.error(`[otomat] run ${ctx.runId} monitor failed`, error))
        .finally(() => {
          inflight.delete(ctx.runId);
          release();
        });
      inflight.set(ctx.runId, { proc, monitor });
    } catch (error) {
      release();
      throw error;
    } finally {
      claiming.delete(ctx.runId);
    }
  }

  async function start(request: StartRunRequest): Promise<RunContract> {
    const ctx = prepareRun(request);
    await spawnTurn(ctx, "run", null);
    const row = getRun(db, ctx.runId);
    if (!row) throw new Error("run vanished immediately after spawn");
    return toRun(row);
  }

  async function resume(runId: string): Promise<RunContract> {
    const run = getRun(db, runId);
    if (!run) throw new Error(`run ${runId} not found`);
    if (run.status !== "awaiting_human") {
      throw new Error(`run ${runId} is not resumable (status ${run.status})`);
    }
    if (inflight.has(runId)) throw new Error(`run ${runId} is already running`);

    const sessions = listAgentSessionsForRun(db, runId);
    const session = pickResumableSession(sessions);
    if (!session) throw new Error(`run ${runId} has no session to resume`);

    const prompt = run.plan_json.steps[0]?.prompt ?? "continue";
    await spawnTurn(
      {
        runId,
        stepRunId: session.step_run_id,
        agentSessionId: session.id,
        prompt,
        runDir: join(dataDir, "runs", runId),
      },
      "resume",
      session.provider_session_id,
    );

    const row = getRun(db, runId);
    if (!row) throw new Error("run vanished immediately after resume");
    return toRun(row);
  }

  async function abort(runId: string, _reason = "aborted by operator"): Promise<void> {
    const run = getRun(db, runId);
    if (!run || runMachine.isTerminal(run.status as RunState)) return;

    aborting.add(runId);
    try {
      const handle = inflight.get(runId);
      if (handle) {
        handle.proc.kill("SIGTERM");
        const exitedInTime = await Promise.race([
          handle.proc.exited.then(() => true),
          delay(ABORT_GRACE_MS).then(() => false),
        ]);
        if (!exitedInTime) {
          handle.proc.kill("SIGKILL");
          await handle.proc.exited;
        }
      }

      const now = nowIso();
      // Ingest whatever the child flushed before dying so the ledger stays complete.
      try {
        new EventTailer({
          db,
          runId,
          filePath: join(dataDir, "runs", runId, "events.jsonl"),
        }).drain();
      } catch (error) {
        console.error(`[otomat] abort drain failed for run ${runId}`, error);
      }

      const current = getRun(db, runId);
      if (!current || runMachine.isTerminal(current.status as RunState)) return;

      // If the worker actually finished (its own terminal marker is in the ledger) before
      // or during the abort, honor that outcome — never overwrite a real completion with a
      // fake cancel. settleRun classifies from the marker (review_ready/failed/canceled).
      if (findFinalStatus(readRunEvents(db, runId)) !== null) {
        settleRun(db, dataDir, current, { emitReconciled: false, probeLiveness: false, now });
        return;
      }

      driveRunTo(db, runId, current.status as RunState, "canceled", now);
      for (const step of listStepRunsForRun(db, runId)) {
        const state = step.status as StepRunState;
        if (!stepRunMachine.isTerminal(state)) driveStepTo(db, step.id, state, "canceled");
      }
      const sessions = listAgentSessionsForRun(db, runId);
      for (const session of sessions) {
        const state = session.status as AgentSessionState;
        if (!agentSessionMachine.isTerminal(state))
          driveSessionTo(db, session.id, state, "terminated");
      }

      emitLedgerEvent(
        db,
        dataDir,
        runId,
        buildTerminalMarker(
          {
            runId,
            stepRunId: sessions[0]?.step_run_id ?? null,
            agentSessionId: sessions[0]?.id ?? null,
          },
          "canceled",
          sessions.find((s) => s.provider_session_id !== null)?.provider_session_id ?? null,
          0,
          now,
        ),
      );
    } finally {
      aborting.delete(runId);
    }
  }

  async function reconcile(): Promise<ReconcileReport> {
    return reconcileRuns(db, dataDir, nowIso());
  }

  async function settle(): Promise<void> {
    await Promise.all([...inflight.values()].map((handle) => handle.monitor));
  }

  return { start, resume, abort, reconcile, settle };
}

function pickResumableSession(sessions: AgentSessionRow[]): AgentSessionRow | undefined {
  return sessions.find((session) => session.provider_session_id !== null) ?? sessions[0];
}

function firstLine(text: string): string {
  const [first = ""] = text.split("\n");
  return first.trim().slice(0, 120);
}
