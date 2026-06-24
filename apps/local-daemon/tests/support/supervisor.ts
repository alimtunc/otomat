import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient, runMigrations, schema, type Db, type DbClient } from "@otomat/db";
import type { AgentSessionState, RunState, StepRunState } from "@otomat/domain";

import type { RuntimeEvent } from "#runtime";
import {
  buildTerminalMarker,
  type ProcessExit,
  type SessionProcess,
  type SpawnSession,
  type SupervisedJob,
} from "#supervisor";

const FAKE_WORKER = join(dirname(fileURLToPath(import.meta.url)), "fake-worker.mjs");

export interface SupervisorTestDb {
  client: DbClient;
  db: Db;
  /** Root the supervisor writes `runs/<id>/events.jsonl` under (mirrors `dirname(dbPath)`). */
  dataDir: string;
  cleanup(): void;
}

export function setupSupervisorDb(): SupervisorTestDb {
  const dir = mkdtempSync(join(tmpdir(), "otomat-sup-"));
  const dbPath = join(dir, "otomat.db");
  runMigrations(dbPath);
  const client = createClient(dbPath);
  client.db.insert(schema.projects).values({ id: "p1", name: "P", root_path: dir }).run();
  client.db.insert(schema.issues).values({ id: "i1", project_id: "p1", title: "I" }).run();
  return {
    client,
    db: client.db,
    dataDir: dir,
    cleanup() {
      client.sqlite.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export interface SeedRunOptions {
  runId: string;
  runStatus: RunState;
  stepStatus: StepRunState;
  sessionStatus: AgentSessionState;
  pid?: number | null;
  pgid?: number | null;
  providerSessionId?: string | null;
}

export interface SeededRun {
  runId: string;
  stepRunId: string;
  agentSessionId: string;
}

/** Seeds a run/step/session chain in arbitrary (e.g. crash-leftover) states with optional process liveness. */
export function seedRun(db: Db, options: SeedRunOptions): SeededRun {
  const stepRunId = `${options.runId}-step`;
  const agentSessionId = `${options.runId}-session`;
  db.insert(schema.runs)
    .values({
      id: options.runId,
      issue_id: "i1",
      status: options.runStatus,
      branch: `otomat/run/${options.runId}`,
      plan_json: {
        version: 1,
        steps: [{ id: stepRunId, name: "Agent turn", agent: "fake", prompt: "p", depends_on: [] }],
      },
    })
    .run();
  db.insert(schema.stepRuns)
    .values({
      id: stepRunId,
      run_id: options.runId,
      idx: 0,
      name: "Agent turn",
      status: options.stepStatus,
    })
    .run();
  db.insert(schema.agentSessions)
    .values({
      id: agentSessionId,
      step_run_id: stepRunId,
      status: options.sessionStatus,
      provider_session_id: options.providerSessionId ?? null,
      pid: options.pid ?? null,
      pgid: options.pgid ?? null,
      started_at: options.pid ? "2026-01-01T00:00:00.000Z" : null,
      last_seen: options.pid ? "2026-01-01T00:00:00.000Z" : null,
    })
    .run();
  return { runId: options.runId, stepRunId, agentSessionId };
}

function event(
  seed: SeededRun,
  type: RuntimeEvent["type"],
  payload: Record<string, unknown>,
): RuntimeEvent {
  return {
    id: `${seed.runId}:${type}:${Object.keys(payload).length}:${payload["text"] ?? ""}`,
    run_id: seed.runId,
    step_run_id: seed.stepRunId,
    agent_session_id: seed.agentSessionId,
    type,
    source: "otomat",
    occurred_at: "2026-01-01T00:00:00.000Z",
    payload,
    raw_ref: null,
  };
}

export function providerSessionEvent(seed: SeededRun, providerSessionId: string): RuntimeEvent {
  return event(seed, "runtime.provider_session", {
    fidelity: "native",
    adapter: "fake",
    test_adapter: true,
    provider_session_id: providerSessionId,
  });
}

export function logEvent(seed: SeededRun, text: string): RuntimeEvent {
  return event(seed, "runtime.log", {
    fidelity: "raw_log",
    adapter: "fake",
    test_adapter: true,
    text,
  });
}

export function completedMarker(seed: SeededRun, providerSessionId: string): RuntimeEvent {
  return buildTerminalMarker(seed, "completed", providerSessionId, 3, "2026-01-01T00:00:01.000Z");
}

/** Writes the run's durable `events.jsonl`; `torn` drops the final newline to mimic a kill mid-write. */
export function writeRunEvents(
  dataDir: string,
  runId: string,
  events: readonly RuntimeEvent[],
  torn = false,
): void {
  const file = join(dataDir, "runs", runId, "events.jsonl");
  mkdirSync(dirname(file), { recursive: true });
  const body = events.map((e) => JSON.stringify(e)).join("\n");
  writeFileSync(file, events.length > 0 && !torn ? `${body}\n` : body);
}

function toHandle(child: ReturnType<typeof spawn>): SessionProcess {
  const pid = child.pid ?? -1;
  const exited = new Promise<ProcessExit>((resolve) => {
    child.on("exit", (code, signal) => resolve({ code, signal }));
    child.on("error", () => resolve({ code: null, signal: null }));
  });
  return {
    pid,
    pgid: pid,
    exited,
    kill: (signal) => {
      try {
        process.kill(-pid, signal);
      } catch {
        // group already gone
      }
    },
  };
}

/** A spawn that launches the real fake-worker process with the given behavior. Records spawned jobs. */
export function workerSpawn(
  behavior: "complete" | "crash" | "linger",
): SpawnSession & { calls: number; jobs: SupervisedJob[] } {
  const spawnFn = (job: SupervisedJob): SessionProcess => {
    spawnFn.calls += 1;
    spawnFn.jobs.push(job);
    const child = spawn(process.execPath, [FAKE_WORKER], {
      env: {
        ...process.env,
        OTOMAT_WORKER_JOB: JSON.stringify(job),
        FAKE_WORKER_BEHAVIOR: behavior,
      },
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return toHandle(child);
  };
  spawnFn.calls = 0;
  spawnFn.jobs = [] as SupervisedJob[];
  return spawnFn;
}

/** Spawns a detached, long-lived process and returns its pid/pgid — an "orphan" for reconciliation. */
export function spawnOrphan(): { pid: number; pgid: number; stop(): void } {
  const child = spawn(process.execPath, ["-e", "setInterval(()=>{}, 1000)"], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  const pid = child.pid ?? -1;
  return {
    pid,
    pgid: pid,
    stop: () => {
      try {
        process.kill(-pid, "SIGKILL");
      } catch {
        // already gone
      }
    },
  };
}

/** Spawns a process, waits for it to exit, and returns its now-dead pid. */
export async function deadPid(): Promise<number> {
  const child = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
  const pid = child.pid ?? -1;
  await new Promise<void>((resolve) => child.on("exit", () => resolve()));
  return pid;
}

/** Polls until `pred` is true or the timeout elapses; resolves to the last observed value. */
export async function waitFor(pred: () => boolean, timeoutMs = 4000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (pred()) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return pred();
}
