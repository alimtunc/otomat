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

/** Conventional per-run evidence file the runtime appends to (OTO-6 `JsonlEventSink`). */
export const EVENTS_FILENAME = "events.jsonl";

const LIVE_TAIL_INTERVAL_MS = 200;

export function runDir(dataDir: string, runId: string): string {
  return join(dataDir, "runs", runId);
}

export function runEventsPath(dataDir: string, runId: string): string {
  return join(runDir(dataDir, runId), EVENTS_FILENAME);
}

export function sessionDir(dataDir: string, runId: string, agentSessionId: string): string {
  return join(runDir(dataDir, runId), "sessions", agentSessionId);
}

export function sessionEventsPath(dataDir: string, runId: string, agentSessionId: string): string {
  return join(sessionDir(dataDir, runId, agentSessionId), EVENTS_FILENAME);
}

function sessionStreamId(agentSessionId: string): string {
  return `session:${agentSessionId}`;
}

export function startSessionTail(
  db: Db,
  dataDir: string,
  runId: string,
  agentSessionId: string,
): EventTailer {
  const tailer = new EventTailer({
    db,
    runId,
    streamId: sessionStreamId(agentSessionId),
    filePath: sessionEventsPath(dataDir, runId, agentSessionId),
  });
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

export function drainSessionEvents(
  db: Db,
  dataDir: string,
  runId: string,
  agentSessionId: string,
): void {
  try {
    new EventTailer({
      db,
      runId,
      streamId: sessionStreamId(agentSessionId),
      filePath: sessionEventsPath(dataDir, runId, agentSessionId),
    }).drain();
  } catch (error) {
    console.error(`[otomat] drain failed for run ${runId} session ${agentSessionId}`, error);
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

/**
 * Appends one event to the run's `events.jsonl` (creating the run dir, and
 * newline-closing a torn final line so the append stays whole), then drains the
 * file into the DB ledger. File-first — never DB-only — so the file stays the
 * replayable source of truth. Synchronous: on return the event is durably in the
 * ledger with its allocated `seq`.
 */
export function emitLedgerEvent(db: Db, dataDir: string, runId: string, event: RuntimeEvent): void {
  const file = runEventsPath(dataDir, runId);
  mkdirSync(dirname(file), { recursive: true });
  const prefix = existsSync(file) && !endsWithNewline(file) ? "\n" : "";
  appendFileSync(file, `${prefix}${JSON.stringify(event)}\n`);
  new EventTailer({ db, runId, filePath: file }).drain();
}
