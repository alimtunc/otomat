import type { EventEnvelope } from "@otomat/domain";
import { expect, it } from "vitest";

import { createDaemonClient } from "#client/client/index";

class FakeEventSource {
  readonly url: string;
  closed = false;
  private readonly listeners = new Map<string, ((event: Event) => void)[]>();

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(type: string, listener: (event: Event) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, data: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      // SAFETY: the subscription reads only data from a delivered SSE event.
      listener({ data } as MessageEvent);
    }
  }
}

const ENVELOPE: EventEnvelope = {
  id: "e0",
  run_id: "run-1",
  step_run_id: null,
  agent_session_id: null,
  seq: 0,
  type: "runtime.log",
  source: "otomat",
  occurred_at: "2026-01-01T00:00:00.000Z",
  payload: {},
  raw_ref: null,
};

function captureEventSource() {
  const sources: FakeEventSource[] = [];
  const factory = class extends FakeEventSource {
    constructor(url: string) {
      super(url);
      sources.push(this);
    }
  };
  const client = createDaemonClient({
    baseUrl: "",
    EventSource: factory,
  });
  return { sources, client };
}

it("delivers SSE events and closes on end", () => {
  const { sources, client } = captureEventSource();

  const received: EventEnvelope[] = [];
  let endStatus = "";
  const sub = client.subscribeRunEvents("run-1", {
    onEvent: (event) => received.push(event),
    onEnd: (payload) => {
      endStatus = payload.status;
    },
  });

  const source = sources[0];
  expect(source.url).toBe("/api/runs/run-1/events");
  source.emit("event", JSON.stringify(ENVELOPE));
  source.emit("end", JSON.stringify({ status: "completed" }));

  expect(received.map((e) => e.seq)).toEqual([0]);
  expect(endStatus).toBe("completed");
  expect(source.closed).toBe(true);
  sub.close();
});

it("routes a malformed SSE frame to onParseError instead of throwing", () => {
  const { sources, client } = captureEventSource();

  const received: EventEnvelope[] = [];
  let parseErrors = 0;
  client.subscribeRunEvents("run-1", {
    onEvent: (event) => received.push(event),
    onParseError: () => {
      parseErrors += 1;
    },
  });

  const source = sources[0];
  expect(() => source.emit("event", "{not json")).not.toThrow();
  expect(() => source.emit("event", JSON.stringify({ nope: true }))).not.toThrow();
  source.emit("event", JSON.stringify(ENVELOPE));

  expect(parseErrors).toBe(2);
  expect(received.map((e) => e.seq)).toEqual([0]);
});

const SNAPSHOT = {
  activities: [
    {
      kind: "run",
      id: "run:run-1",
      bucket: "running",
      status: "running",
      started_at: "2026-01-01T00:00:00.000Z",
      project: { id: "project-1", name: "Otomat" },
      issue: { id: "issue-1", identifier: "ABC-1", title: "Ship it" },
      run_id: "run-1",
      phase: "Implement",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  observed_at: "2026-01-01T00:00:00.000Z",
};

it("delivers each activity snapshot the host pushes", () => {
  const { sources, client } = captureEventSource();

  const received: string[][] = [];
  const sub = client.subscribeActivity({
    onSnapshot: (snapshot) => received.push(snapshot.activities.map((activity) => activity.id)),
  });

  const source = sources[0];
  expect(source.url).toBe("/api/activity/stream");
  source.emit("snapshot", JSON.stringify(SNAPSHOT));
  source.emit("snapshot", JSON.stringify({ ...SNAPSHOT, activities: [] }));

  expect(received).toEqual([["run:run-1"], []]);
  sub.close();
  expect(source.closed).toBe(true);
});

it("routes a malformed activity frame to onParseError instead of throwing", () => {
  const { sources, client } = captureEventSource();

  let parseErrors = 0;
  client.subscribeActivity({
    onSnapshot: () => {},
    onParseError: () => {
      parseErrors += 1;
    },
  });

  expect(() => sources[0].emit("snapshot", "{not json")).not.toThrow();

  expect(parseErrors).toBe(1);
});

const CONVERSATION_SNAPSHOT = {
  entries: [
    {
      id: "conversation:step-1",
      project: { id: "project-1", name: "Otomat" },
      issue: { id: "issue-1", identifier: "ABC-1", title: "Ship it", cycle: "running" },
      run_id: "run-1",
      run_status: "running",
      step_run_id: "step-1",
      step_name: "Implement",
      step_status: "running",
      participant: { runtime: "claude", profile_name: null, model: "opus", effort: null },
      last: { kind: "agent", text: "Done.", at: "2026-01-01T00:00:00.000Z" },
      pending_interaction: null,
      queued_contributions: 0,
      updated_at: "2026-01-01T00:00:00.000Z",
      read: false,
      archived: false,
    },
  ],
  observed_at: "2026-01-01T00:00:00.000Z",
};

it("delivers each conversations snapshot the host pushes and closes with the subscription", () => {
  const { sources, client } = captureEventSource();

  const received: string[][] = [];
  const sub = client.subscribeConversations({
    onSnapshot: (snapshot) => received.push(snapshot.entries.map((entry) => entry.id)),
  });

  const source = sources[0];
  expect(source.url).toBe("/api/conversations/stream");
  source.emit("snapshot", JSON.stringify(CONVERSATION_SNAPSHOT));
  source.emit("snapshot", JSON.stringify({ ...CONVERSATION_SNAPSHOT, entries: [] }));

  expect(received).toEqual([["conversation:step-1"], []]);
  sub.close();
  expect(source.closed).toBe(true);
});
