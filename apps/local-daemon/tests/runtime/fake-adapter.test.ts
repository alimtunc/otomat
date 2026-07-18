import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runtimeFinalStateSchema } from "#runtime/contract";
import { EVENT_FIDELITY, runtimeEventSchema } from "#runtime/events";
import { FAKE_ADAPTER_ID, FakeRuntimeAdapter } from "#runtime/providers/fake/adapter";
import { JsonlEventSink, MemorySink, readEventsJsonl } from "#runtime/sinks";

import { runtimeRunInput, runtimeSessionRef } from "../support/runtime.js";

let dir: string;
let adapter: FakeRuntimeAdapter;

const RUN_EPOCH_MS = Date.parse("2026-07-14T12:00:00.000Z");
const fixedClock = () => RUN_EPOCH_MS;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "otomat-fake-"));
  adapter = new FakeRuntimeAdapter(fixedClock);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const input = () => runtimeRunInput({ run_dir: dir, prompt: "do the thing" });

const sessionRef = () => runtimeSessionRef("fake-session-run-1");

const liveSignal = (): AbortSignal => new AbortController().signal;

describe("FakeRuntimeAdapter contract", () => {
  it("exposes a lean 6-flag capability model and a test-adapter identity", () => {
    expect(adapter.id).toBe(FAKE_ADAPTER_ID);
    expect(adapter.displayName).toMatch(/test adapter/i);
    expect(Object.keys(adapter.capabilities).toSorted()).toEqual([
      "abort",
      "diff_hints",
      "permissions",
      "resume",
      "send_message",
      "stream",
    ]);
  });
});

describe("FakeRuntimeAdapter.run", () => {
  it("pushes a deterministic lifecycle and returns a completed final state", async () => {
    const sink = new MemorySink();
    const final = await adapter.run(input(), sink, liveSignal());

    expect(runtimeFinalStateSchema.parse(final)).toEqual(final);
    expect(final.status).toBe("completed");
    expect(final.provider_session_id).toBe("fake-session-run-1");
    expect(final.usage).not.toBeNull();
    expect(sink.events).toHaveLength(10);
    expect(final.event_count).toBe(sink.events.length);
  });

  it("emits events at all three fidelity tiers, each a valid runtime event", async () => {
    const sink = new MemorySink();
    await adapter.run(input(), sink, liveSignal());
    for (const event of sink.events) {
      expect(() => runtimeEventSchema.parse(event)).not.toThrow();
    }
    const tiers = new Set(sink.events.map((e) => e.payload.fidelity));
    expect([...tiers].toSorted()).toEqual([...EVENT_FIDELITY].toSorted());
  });

  it("labels every event as test data and never as a real provider", async () => {
    const sink = new MemorySink();
    await adapter.run(input(), sink, liveSignal());
    for (const event of sink.events) {
      expect(event.source).toBe("otomat");
      expect(event.source).not.toBe("claude");
      expect(event.source).not.toBe("codex");
      expect(event.payload.adapter).toBe(FAKE_ADAPTER_ID);
      expect(event.payload.test_adapter).toBe(true);
    }
  });

  it("never assigns seq (the OTO-7 ledger owns sequence allocation)", async () => {
    const sink = new MemorySink();
    await adapter.run(input(), sink, liveSignal());
    for (const event of sink.events) {
      expect(event).not.toHaveProperty("seq");
    }
  });

  it("is deterministic: a fresh adapter replays byte-identical events", async () => {
    const a = new MemorySink();
    const b = new MemorySink();
    await new FakeRuntimeAdapter(fixedClock).run(
      { ...input(), run_dir: mkdtempSync(join(tmpdir(), "otomat-a-")) },
      a,
      liveSignal(),
    );
    await new FakeRuntimeAdapter(fixedClock).run(
      { ...input(), run_dir: mkdtempSync(join(tmpdir(), "otomat-b-")) },
      b,
      liveSignal(),
    );
    expect(a.events).toEqual(b.events);
  });

  it("stamps every event from a fresh clock reading, monotonic across run and resume", async () => {
    let now = RUN_EPOCH_MS;
    const steppingClock = () => {
      const value = now;
      now += 1000;
      return value;
    };
    const stepped = new FakeRuntimeAdapter(steppingClock);

    const runSink = new MemorySink();
    await stepped.run(input(), runSink, liveSignal());
    expect(runSink.events).toHaveLength(10);
    expect(runSink.events.map((event) => event.occurred_at)).toEqual(
      Array.from({ length: 10 }, (_, index) => new Date(RUN_EPOCH_MS + index * 1000).toISOString()),
    );

    const resumeSink = new MemorySink();
    await stepped.resume(
      sessionRef(),
      { prompt: "follow up", run_dir: dir },
      resumeSink,
      liveSignal(),
    );
    expect(resumeSink.events).toHaveLength(5);
    expect(resumeSink.events.map((event) => event.occurred_at)).toEqual(
      Array.from({ length: 5 }, (_, index) =>
        new Date(RUN_EPOCH_MS + (10 + index) * 1000).toISOString(),
      ),
    );
  });

  it("emits only to the caller's sink — durability belongs to the sink, never to the adapter", async () => {
    const sink = new MemorySink();
    await adapter.run(input(), sink, liveSignal());
    expect(existsSync(join(dir, "events.jsonl"))).toBe(false);

    const jsonl = new JsonlEventSink(join(dir, "events.jsonl"));
    await new FakeRuntimeAdapter(fixedClock).run(input(), jsonl, liveSignal());
    jsonl.close();
    expect(readEventsJsonl(join(dir, "events.jsonl"))).toEqual(sink.events);
  });

  it("keeps ids unique across separate adapter instances, as multi-step worker processes are", async () => {
    // Colliding ids across fresh per-step workers would be silently dropped by the ledger's conflict guard.
    const sinkA = new MemorySink();
    const sinkB = new MemorySink();
    await new FakeRuntimeAdapter(fixedClock).run(
      runtimeRunInput({ run_dir: dir, agent_session_id: "sess-1" }),
      sinkA,
      liveSignal(),
    );
    await new FakeRuntimeAdapter(fixedClock).run(
      runtimeRunInput({ run_dir: dir, agent_session_id: "sess-2" }),
      sinkB,
      liveSignal(),
    );
    const ids = [...sinkA.events, ...sinkB.events].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("FakeRuntimeAdapter abort", () => {
  it("returns canceled and emits a single abort log when pre-aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    const sink = new MemorySink();
    const final = await adapter.run(input(), sink, ac.signal);

    expect(final.status).toBe("canceled");
    expect(final.usage).toBeNull();
    expect(sink.events).toHaveLength(1);
    expect(final.event_count).toBe(1);
    expect(sink.events[0]?.payload.text).toContain("aborted");
  });

  it("resolves abort(session, reason) without throwing", async () => {
    await expect(adapter.abort(sessionRef(), "user_canceled")).resolves.toBeUndefined();
  });
});

describe("FakeRuntimeAdapter.resume", () => {
  it("reuses the provider session and completes a follow-up turn", async () => {
    const sink = new MemorySink();
    const final = await adapter.resume(
      sessionRef(),
      { prompt: "follow up", run_dir: dir },
      sink,
      liveSignal(),
    );

    expect(final.status).toBe("completed");
    expect(final.provider_session_id).toBe("fake-session-run-1");
    expect(sink.events.length).toBeGreaterThan(0);
  });

  it("appends a resume turn to the caller's jsonl sink without losing the prior turn", async () => {
    const path = join(dir, "events.jsonl");
    const first = new JsonlEventSink(path);
    await adapter.run(input(), first, liveSignal());
    first.close();
    const firstTurn = readEventsJsonl(path);

    const second = new JsonlEventSink(path);
    await adapter.resume(sessionRef(), { prompt: "more", run_dir: dir }, second, liveSignal());
    second.close();

    const onDisk = readEventsJsonl(path);
    expect(onDisk.slice(0, firstTurn.length)).toEqual(firstTurn);
    expect(onDisk.length).toBeGreaterThan(firstTurn.length);
    const ids = onDisk.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
