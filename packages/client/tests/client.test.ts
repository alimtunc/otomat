import type { EventEnvelope } from "@otomat/domain";
import { expect, it, vi } from "vitest";

import { createDaemonClient } from "#client/client";
import { DaemonRequestError } from "#client/types";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

const ISSUE = {
  id: "issue-1",
  project_id: "project-1",
  title: "First",
  body: null,
  status: "ready",
  source: "local",
  source_external_id: null,
  synced_at: null,
};

it("parses a typed list response", async () => {
  const fetchMock: typeof fetch = vi.fn(async () => jsonResponse([ISSUE]));
  const client = createDaemonClient({ fetch: fetchMock });
  const issues = await client.listIssues();
  expect(issues).toHaveLength(1);
  expect(issues[0].status).toBe("ready");
});

it("appends defined query params only", async () => {
  let calledUrl = "";
  const fetchMock: typeof fetch = async (input) => {
    calledUrl = String(input);
    return jsonResponse([]);
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });
  await client.listRuns({ issueId: "issue-1" });
  expect(calledUrl).toBe("http://localhost:4319/api/runs?issueId=issue-1");
});

it("throws DaemonRequestError on a non-2xx response", async () => {
  const fetchMock: typeof fetch = async () => jsonResponse({ error: "run_not_found" }, 404);
  const client = createDaemonClient({ fetch: fetchMock });
  await expect(client.getRun("missing")).rejects.toBeInstanceOf(DaemonRequestError);
});

it("posts a start-run request body", async () => {
  let captured: { method?: string; body?: unknown } = {};
  const run = {
    id: "run-1",
    issue_id: "issue-1",
    status: "running",
    branch: "b",
    plan_json: { version: 1, steps: [] },
  };
  const fetchMock: typeof fetch = async (_input, init) => {
    captured = { method: init?.method, body: init?.body };
    return jsonResponse(run, 201);
  };
  const client = createDaemonClient({ fetch: fetchMock });
  const result = await client.startRun({ prompt: "go" });
  expect(captured.method).toBe("POST");
  expect(JSON.parse(String(captured.body))).toEqual({ prompt: "go" });
  expect(result.id).toBe("run-1");
});

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

it("delivers SSE events and closes on end", () => {
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
