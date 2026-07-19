import { appendFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EVENTS_FILENAME } from "#events";
import { readRunEvents } from "#events/projection";
import { EventTailer } from "#events/tailer";
import { FakeRuntimeAdapter, JsonlEventSink, readEventsJsonl } from "#runtime";

import { setupLedgerDb, type LedgerTestDb } from "../support/ledger-db.js";
import { makeEvent } from "../support/run-event-fixtures.js";

let t: LedgerTestDb;
let filePath: string;

beforeEach(() => {
  t = setupLedgerDb();
  filePath = join(t.dir, EVENTS_FILENAME);
});

afterEach(() => {
  t.cleanup();
});

function writeLines(count: number, fromIndex = 0): void {
  const sink = new JsonlEventSink(filePath);
  for (let i = fromIndex; i < fromIndex + count; i++) sink.emit(makeEvent(t.runId, i));
  sink.close();
}

function newTailer(): EventTailer {
  return new EventTailer({ db: t.client.db, runId: t.runId, filePath });
}

function seqs(): number[] {
  return readRunEvents(t.client.db, t.runId).map((e) => e.seq);
}

describe("EventTailer", () => {
  it("ingests an events.jsonl produced by the OTO-6 fake adapter into the ledger", async () => {
    const adapter = new FakeRuntimeAdapter();
    const sink = new JsonlEventSink(filePath);
    await adapter.run(
      {
        run_id: t.runId,
        step_run_id: t.stepRunId,
        agent_session_id: t.agentSessionId,
        prompt: "do the thing",
        run_dir: t.dir,
      },
      sink,
      new AbortController().signal,
    );
    sink.close();

    const onDisk = readEventsJsonl(filePath);
    const result = newTailer().drain();

    expect(result.ingested).toBe(onDisk.length);
    const persisted = readRunEvents(t.client.db, t.runId);
    expect(persisted).toHaveLength(onDisk.length);
    expect(persisted.map((e) => e.id)).toEqual(onDisk.map((e) => e.id));
  });

  it("allocates a monotonic, gapless per-run seq", () => {
    writeLines(6);
    newTailer().drain();
    expect(seqs()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("is non-lossy past the 256 mark (a bounded ring buffer would drop here)", () => {
    writeLines(1000);
    const result = newTailer().drain();

    expect(result.ingested).toBe(1000);
    expect(seqs()).toEqual(Array.from({ length: 1000 }, (_, i) => i));
  });

  it("resumes after a mid-stream kill with no loss and no duplication", () => {
    writeLines(5);
    newTailer().drain(); // tailer A persists lines 0..4, then is "killed" (dropped)

    writeLines(5, 5); // 5 more lines land while no tailer is running

    const resumed = newTailer().drain(); // tailer B starts fresh, resumes from the DB
    expect(resumed.ingested).toBe(5); // only the new lines, not the already-stored ones
    expect(seqs()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]); // no loss, no dup, monotonic

    expect(newTailer().drain().ingested).toBe(0); // a further restart ingests nothing
    expect(readRunEvents(t.client.db, t.runId)).toHaveLength(10);
  });

  it("ingests a line only once it is newline-terminated", () => {
    const sink = new JsonlEventSink(filePath);
    sink.emit(makeEvent(t.runId, 0));
    sink.close();
    appendFileSync(filePath, JSON.stringify(makeEvent(t.runId, 1))); // torn: no trailing newline

    const tailer = newTailer();
    expect(tailer.drain().ingested).toBe(1); // the torn second line is not ingested

    appendFileSync(filePath, "\n"); // complete the second line
    expect(tailer.drain().ingested).toBe(1);
    expect(seqs()).toEqual([0, 1]);
  });

  it("skips a corrupt line without stalling or consuming a global ledger seq", () => {
    const sink = new JsonlEventSink(filePath);
    sink.emit(makeEvent(t.runId, 0));
    sink.close();
    appendFileSync(filePath, "{ this is not valid json }\n"); // corrupt line 1
    const sink2 = new JsonlEventSink(filePath);
    sink2.emit(makeEvent(t.runId, 2));
    sink2.close();

    const result = newTailer().drain();

    expect(result.ingested).toBe(2); // lines 0 and 2; line 1 dropped, not fatal
    expect(seqs()).toEqual([0, 1]);
    expect(result.nextSeq).toBe(2);
  });

  it("polls and ingests on an interval via start/stop", () => {
    vi.useFakeTimers();
    try {
      writeLines(3);
      const tailer = newTailer();
      tailer.start(5);
      vi.advanceTimersByTime(5);
      tailer.stop();
      expect(readRunEvents(t.client.db, t.runId)).toHaveLength(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
