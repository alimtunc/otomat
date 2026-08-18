import { readMaxConcurrentSessions, type Db } from "@otomat/db";
import type { LinearLifecycleSync } from "@otomat/domain";

import type { EventTailer } from "#events";
import type { RepositoryResolver } from "#git";

import { Semaphore } from "./semaphore.js";
import type { ReconcileOutcome, SessionProcess, SpawnSession, SupervisorConfig } from "./types.js";

interface StartingProcess {
  runId: string;
  proc: SessionProcess;
  /** The session this process is a turn of, so abort can settle against the right ledger slice. */
  turn: { agentSessionId: string };
}

interface InflightProcess extends StartingProcess {
  monitor: Promise<void>;
  /** Live tailer draining the child's `events.jsonl` into the ledger while it runs. */
  tail: EventTailer;
}

export interface SupervisorState {
  db: Db;
  dataDir: string;
  defaultProjectId: string;
  spawn: SpawnSession;
  repositories: RepositoryResolver;
  afterSettle: ((outcome: ReconcileOutcome) => void) | null;
  syncIssueLifecycle: LinearLifecycleSync | null;
  slots: Semaphore;
  inflight: Map<string, InflightProcess>;
  /** Spawned but gated workers whose durable identity is still being recorded. */
  starting: Map<string, StartingProcess>;
  /** Runs whose abort owns the settle, so the exit monitor never races a second finalize. */
  aborting: Set<string>;
  /** Session ids reserved between the spawn guard and `inflight.set`. */
  claiming: Map<string, string>;
  /** Live init-command controllers per run, so abort and shutdown can interrupt a command already running. */
  initInterrupts: Map<string, Set<AbortController>>;
  /** Launches waiting for a global concurrency slot or completing their spawn bookkeeping. */
  pending: Set<Promise<void>>;
  /** Run-level scheduler guard; sessions within one compete group remain independently claimable. */
  advancing: Set<string>;
  /** Run-level delivery guard so two contribution posts never batch the same queue twice. */
  delivering: Set<string>;
  /** Prevents turns queued on the semaphore from spawning while daemon shutdown drains live workers. */
  shuttingDown: boolean;
  /** Wired by `createSupervisor` to advance the plan then flush the run's queued contributions; injected to keep `lifecycle` free of a module cycle. */
  advance: ((runId: string) => Promise<void>) | null;
}

export function createState(config: SupervisorConfig): SupervisorState {
  return {
    db: config.db,
    dataDir: config.dataDir,
    defaultProjectId: config.defaultProjectId,
    spawn: config.spawn,
    repositories: config.repositories,
    afterSettle: config.afterSettle ?? null,
    syncIssueLifecycle: config.syncIssueLifecycle ?? null,
    slots: new Semaphore(readMaxConcurrentSessions(config.db)),
    inflight: new Map(),
    starting: new Map(),
    aborting: new Set(),
    claiming: new Map(),
    initInterrupts: new Map(),
    pending: new Set(),
    advancing: new Set(),
    delivering: new Set(),
    shuttingDown: false,
    advance: null,
  };
}

export function hasRunActivity(state: SupervisorState, runId: string): boolean {
  if ([...state.inflight.values()].some((handle) => handle.runId === runId)) return true;
  return [...state.claiming.values()].some((claimRunId) => claimRunId === runId);
}

/** Tracks background work in `state.pending` so `settle`/`shutdown` observe it. `work` must handle its own failures. */
export function trackPending(state: SupervisorState, work: Promise<void>): Promise<void> {
  let pending: Promise<void>;
  pending = work.finally(() => state.pending.delete(pending));
  state.pending.add(pending);
  return pending;
}

export function processesForRun(
  state: SupervisorState,
  runId: string,
): Array<InflightProcess | StartingProcess> {
  return [...state.starting.values(), ...state.inflight.values()].filter(
    (handle) => handle.runId === runId,
  );
}
