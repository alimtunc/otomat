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

function captureEventSource(): {
  sources: FakeEventSource[];
  client: ReturnType<typeof createDaemonClient>;
} {
  const sources: FakeEventSource[] = [];
  const factory = class extends FakeEventSource {
    constructor(url: string) {
      super(url);
      sources.push(this);
    }
  };
  const client = createDaemonClient({
    baseUrl: "",
    EventSource: factory as unknown as typeof EventSource,
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
