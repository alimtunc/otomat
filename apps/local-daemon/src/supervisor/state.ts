import type { Db } from "@otomat/db";

import type { EventTailer } from "#events";
import type { RepositoryResolver } from "#git";

import { Semaphore } from "./semaphore.js";
import {
  DEFAULT_CONCURRENCY,
  type ReconcileOutcome,
  type SessionProcess,
  type SpawnSession,
  type SupervisorConfig,
} from "./types.js";

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
  slots: Semaphore;
  inflight: Map<string, InflightProcess>;
  /** Spawned but gated workers whose durable identity is still being recorded. */
  starting: Map<string, StartingProcess>;
  /** Runs whose abort owns the settle, so the exit monitor never races a second finalize. */
  aborting: Set<string>;
  /** Session ids reserved between the spawn guard and `inflight.set`. */
  claiming: Map<string, string>;
  /** Launches waiting for a global concurrency slot or completing their spawn bookkeeping. */
  pending: Set<Promise<void>>;
  /** Run-level scheduler guard; sessions within one compete group remain independently claimable. */
  advancing: Set<string>;
  /** Prevents turns queued on the semaphore from spawning while daemon shutdown drains live workers. */
  shuttingDown: boolean;
  /** Wired by `createSupervisor` to the plan scheduler; the exit monitor chains it after a live settle. Injected to keep `lifecycle` free of a module cycle. */
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
    slots: new Semaphore(config.concurrency ?? DEFAULT_CONCURRENCY),
    inflight: new Map(),
    starting: new Map(),
    aborting: new Set(),
    claiming: new Map(),
    pending: new Set(),
    advancing: new Set(),
    shuttingDown: false,
    advance: null,
  };
}

export function hasRunActivity(state: SupervisorState, runId: string): boolean {
  if ([...state.inflight.values()].some((handle) => handle.runId === runId)) return true;
  return [...state.claiming.values()].some((claimRunId) => claimRunId === runId);
}

export function processesForRun(
  state: SupervisorState,
  runId: string,
): Array<InflightProcess | StartingProcess> {
  return [...state.starting.values(), ...state.inflight.values()].filter(
    (handle) => handle.runId === runId,
  );
}

/** A failing settle listener must never break the settle itself (or the exit monitor). */
export function notifyAfterSettle(state: SupervisorState, outcome: ReconcileOutcome | null): void {
  if (outcome === null || state.afterSettle === null) return;
  try {
    state.afterSettle(outcome);
  } catch (error) {
    console.error(`[otomat] after-settle hook failed for run ${outcome.runId}`, error);
  }
}
