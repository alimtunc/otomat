import { randomUUID } from "node:crypto";
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
import type { EventEnvelope } from "@otomat/domain";

import { EventTailer } from "#events";
import type { RuntimeEvent } from "#runtime";

import { SUPERVISOR_ADAPTER, type ReconcileClassification } from "./types.js";

/** Terminal outcome a runtime turn reports. Mirrors the run machine's terminal set. */
export type RunFinalPhase = "completed" | "failed" | "canceled";

interface SessionRef {
  runId: string;
  stepRunId: string | null;
  agentSessionId: string | null;
}

/**
 * The durable completion sentinel a worker appends to `events.jsonl` as its last
 * line. Because it lives in the ledger (not just the adapter's return value), a
 * daemon that crashed and restarted can still tell a finished run from a torn one.
 */
export function buildTerminalMarker(
  ref: SessionRef,
  finalStatus: RunFinalPhase,
  providerSessionId: string | null,
  eventCount: number,
  occurredAt: string,
): RuntimeEvent {
  return {
    id: `${ref.runId}:final:${randomUUID()}`,
    run_id: ref.runId,
    step_run_id: ref.stepRunId,
    agent_session_id: ref.agentSessionId,
    type: "run.lifecycle",
    source: "otomat",
    occurred_at: occurredAt,
    payload: {
      fidelity: "parsed",
      adapter: SUPERVISOR_ADAPTER,
      phase: "final",
      final_status: finalStatus,
      provider_session_id: providerSessionId,
      event_count: eventCount,
    },
    raw_ref: null,
  };
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isSupervisorFinal(event: EventEnvelope): boolean {
  return (
    event.type === "run.lifecycle" &&
    event.payload["adapter"] === SUPERVISOR_ADAPTER &&
    event.payload["phase"] === "final"
  );
}

/** The final-status of the last terminal marker in the ledger, or null if the run never wrote one. */
export function findFinalStatus(events: readonly EventEnvelope[]): RunFinalPhase | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event && isSupervisorFinal(event)) {
      const status = asString(event.payload["final_status"]);
      if (status === "completed" || status === "failed" || status === "canceled") return status;
    }
  }
  return null;
}

/**
 * The provider session id the run established, if any — proof the run is resumable.
 * Read from the terminal marker first, else from the runtime's `provider_session` event.
 */
export function findProviderSessionId(events: readonly EventEnvelope[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (!event) continue;
    if (isSupervisorFinal(event)) {
      const fromMarker = asString(event.payload["provider_session_id"]);
      if (fromMarker !== null) return fromMarker;
    }
    if (event.type === "runtime.provider_session") {
      const fromFrame = asString(event.payload["provider_session_id"]);
      if (fromFrame !== null) return fromFrame;
    }
  }
  return null;
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
 * Appends a supervisor-authored event by writing it to the run's `events.jsonl` and
 * draining it into the ledger — same path as the runtime's own events. Routing it
 * through the file (rather than a DB-only insert) keeps the tailer's invariant that
 * per-run `seq` equals the file line index, so a later resume turn appended to the
 * same file resumes from the correct byte offset and never skips a line. A torn final
 * line is closed with a newline first so the appended event can't merge into it.
 */
export function emitLedgerEvent(db: Db, dataDir: string, runId: string, event: RuntimeEvent): void {
  const file = join(dataDir, "runs", runId, "events.jsonl");
  mkdirSync(dirname(file), { recursive: true });
  const prefix = existsSync(file) && !endsWithNewline(file) ? "\n" : "";
  appendFileSync(file, `${prefix}${JSON.stringify(event)}\n`);
  new EventTailer({ db, runId, filePath: file }).drain();
}

/** The `system.reconciled` event surfaced on the run's timeline after boot reconciliation. */
export function buildReconciledEvent(
  ref: SessionRef,
  classification: ReconcileClassification,
  reason: string,
  providerSessionId: string | null,
  orphanTerminated: boolean,
  occurredAt: string,
): RuntimeEvent {
  return {
    id: `${ref.runId}:reconciled:${randomUUID()}`,
    run_id: ref.runId,
    step_run_id: ref.stepRunId,
    agent_session_id: ref.agentSessionId,
    type: "system.reconciled",
    source: "system",
    occurred_at: occurredAt,
    payload: {
      fidelity: "parsed",
      adapter: SUPERVISOR_ADAPTER,
      classification,
      reason,
      provider_session_id: providerSessionId,
      orphan_terminated: orphanTerminated,
    },
    raw_ref: null,
  };
}
