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

export interface InflightProcess {
  proc: SessionProcess;
  monitor: Promise<void>;
  /** Live tailer draining the child's `events.jsonl` into the ledger while it runs. */
  tail: EventTailer;
  /** The session this process is a turn of, so abort can settle against the right ledger slice. */
  turn: { agentSessionId: string };
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
  /** Runs whose abort owns the settle, so the exit monitor never races a second finalize. */
  aborting: Set<string>;
  /** Runs reserved between the spawn guard and `inflight.set`, so concurrent starts can't double-spawn. */
  claiming: Set<string>;
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
    aborting: new Set(),
    claiming: new Set(),
    advance: null,
  };
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
