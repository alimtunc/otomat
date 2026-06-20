import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { RuntimeEvent } from "./events.js";
import { JsonlEventSink, MemorySink, createTeeSink, readEventsJsonl } from "./sinks.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "otomat-sinks-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const sampleEvent = (id: string): RuntimeEvent => ({
  id,
  run_id: "run-1",
  step_run_id: "step-1",
  agent_session_id: "sess-1",
  type: "runtime.log",
  source: "otomat",
  occurred_at: "2026-01-01T00:00:00.000Z",
  payload: { fidelity: "raw_log", adapter: "fake", test_adapter: true, text: id },
  raw_ref: null,
});

describe("sinks", () => {
  it("MemorySink collects events in emission order", () => {
    const sink = new MemorySink();
    sink.emit(sampleEvent("a"));
    sink.emit(sampleEvent("b"));
    expect(sink.events.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("createTeeSink fans every emission out to all sinks", () => {
    const a = new MemorySink();
    const b = new MemorySink();
    const tee = createTeeSink([a, b]);
    tee.emit(sampleEvent("x"));
    expect(a.events).toEqual(b.events);
    expect(a.events).toHaveLength(1);
  });

  it("JsonlEventSink writes lines that round-trip through readEventsJsonl", () => {
    const path = join(dir, "nested", "events.jsonl");
    const sink = new JsonlEventSink(path);
    const events = [sampleEvent("1"), sampleEvent("2")];
    for (const e of events) sink.emit(e);
    sink.close();
    expect(readEventsJsonl(path)).toEqual(events);
  });

  it("readEventsJsonl ignores trailing blank lines", () => {
    const path = join(dir, "events.jsonl");
    writeFileSync(path, `${JSON.stringify(sampleEvent("only"))}\n\n`);
    expect(readEventsJsonl(path)).toHaveLength(1);
  });
});
