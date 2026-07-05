import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  statSync,
} from "node:fs";
import { dirname, join } from "node:path";

import type { Db } from "@otomat/db";

import type { RuntimeEvent } from "#runtime";

import { EventTailer } from "./tailer.js";
import { EVENTS_FILENAME } from "./types.js";

const LIVE_TAIL_INTERVAL_MS = 200;

export function runDir(dataDir: string, runId: string): string {
  return join(dataDir, "runs", runId);
}

export function runEventsPath(dataDir: string, runId: string): string {
  return join(runDir(dataDir, runId), EVENTS_FILENAME);
}

// Overlap between the live tail and the final drain is idempotent via the (run_id, seq) unique index.
export function startLiveTail(db: Db, dataDir: string, runId: string): EventTailer {
  const tailer = new EventTailer({ db, runId, filePath: runEventsPath(dataDir, runId) });
  tailer.start(LIVE_TAIL_INTERVAL_MS);
  return tailer;
}

/** Best-effort ingest of whatever a child flushed to `events.jsonl` into the DB ledger. */
export function drainRunEvents(db: Db, dataDir: string, runId: string): void {
  try {
    new EventTailer({ db, runId, filePath: runEventsPath(dataDir, runId) }).drain();
  } catch (error) {
    console.error(`[otomat] drain failed for run ${runId}`, error);
  }
}

function endsWithNewline(file: string): boolean {
  const size = statSync(file).size;
  if (size === 0) return true;
  const fd = openSync(file, "r");
  try {
    const buffer = Buffer.alloc(1);
    readSync(fd, buffer, 0, 1, size - 1);
    return buffer[0] === 0x0a;
  } finally {
    closeSync(fd);
  }
}

// File-first (never DB-only) so per-run seq stays equal to the jsonl line index across resume turns; a torn final line is newline-closed first.
export function emitLedgerEvent(db: Db, dataDir: string, runId: string, event: RuntimeEvent): void {
  const file = runEventsPath(dataDir, runId);
  mkdirSync(dirname(file), { recursive: true });
  const prefix = existsSync(file) && !endsWithNewline(file) ? "\n" : "";
  appendFileSync(file, `${prefix}${JSON.stringify(event)}\n`);
  new EventTailer({ db, runId, filePath: file }).drain();
}
