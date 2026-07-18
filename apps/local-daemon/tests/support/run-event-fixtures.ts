import { mkdirSync, writeFileSync } from "node:fs";

import { expect } from "vitest";

import { runDir, runEventsPath } from "#events";
import type { RuntimeEvent } from "#runtime";
import { buildTerminalMarker } from "#supervisor";

import type { SeededRun } from "./seed.js";

export function makeEvent(
  runId: string,
  index: number,
  overrides: Partial<RuntimeEvent> = {},
): RuntimeEvent {
  return {
    id: `${runId}:${index}`,
    run_id: runId,
    step_run_id: null,
    agent_session_id: null,
    type: "runtime.log",
    source: "otomat",
    occurred_at: "2026-01-01T00:00:00.000Z",
    payload: { fidelity: "raw_log", adapter: "fake", test_adapter: true, text: `e${index}` },
    raw_ref: null,
    ...overrides,
  };
}

function event(
  seed: SeededRun,
  type: RuntimeEvent["type"],
  payload: RuntimeEvent["payload"],
): RuntimeEvent {
  return makeEvent(seed.runId, 0, {
    // step-scoped so multi-step fixtures never collide on the events PK.
    id: `${seed.runId}:${seed.stepRunId}:${type}:${Object.keys(payload).length}:${payload["provider_session_id"] ?? payload["text"] ?? ""}`,
    step_run_id: seed.stepRunId,
    agent_session_id: seed.agentSessionId,
    type,
    payload,
  });
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

/** Writes the run's durable `events.jsonl`. */
export function writeRunEvents(
  dataDir: string,
  runId: string,
  events: readonly RuntimeEvent[],
): void {
  const file = runEventsPath(dataDir, runId);
  mkdirSync(runDir(dataDir, runId), { recursive: true });
  const body = events.map((e) => JSON.stringify(e)).join("\n");
  writeFileSync(file, events.length > 0 ? `${body}\n` : body);
}

/** Asserts the ledger's per-run seq equals the jsonl line index (no gap, no duplicate). */
export function expectContiguousSeqs(events: readonly { seq: number }[]): void {
  expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i));
}
