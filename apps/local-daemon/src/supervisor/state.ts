import type { Db } from "@otomat/db";

import type { EventTailer } from "#events";

import { Semaphore } from "./semaphore.js";
import {
  DEFAULT_CONCURRENCY,
  type SessionProcess,
  type SpawnSession,
  type SupervisorConfig,
} from "./types.js";

export interface InflightProcess {
  proc: SessionProcess;
  monitor: Promise<void>;
  /** Live tailer draining the child's `events.jsonl` into the ledger while it runs. */
  tail: EventTailer;
}

export interface SupervisorState {
  db: Db;
  dataDir: string;
  defaultProjectId: string;
  spawn: SpawnSession;
  slots: Semaphore;
  inflight: Map<string, InflightProcess>;
  /** Runs whose abort owns the settle, so the exit monitor never races a second finalize. */
  aborting: Set<string>;
  /** Runs reserved between the spawn guard and `inflight.set`, so concurrent starts can't double-spawn. */
  claiming: Set<string>;
}

export function createState(config: SupervisorConfig): SupervisorState {
  return {
    db: config.db,
    dataDir: config.dataDir,
    defaultProjectId: config.defaultProjectId,
    spawn: config.spawn,
    slots: new Semaphore(config.concurrency ?? DEFAULT_CONCURRENCY),
    inflight: new Map(),
    aborting: new Set(),
    claiming: new Set(),
  };
}
