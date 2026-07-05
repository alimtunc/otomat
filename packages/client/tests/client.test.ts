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

const RUN = {
  id: "run-1",
  issue_id: "issue-1",
  status: "running",
  branch: "b",
  plan_json: { version: 1, steps: [] },
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
  const fetchMock: typeof fetch = async (_input, init) => {
    captured = { method: init?.method, body: init?.body };
    return jsonResponse(RUN, 201);
  };
  const client = createDaemonClient({ fetch: fetchMock });
  const result = await client.startRun({ prompt: "go" });
  expect(captured.method).toBe("POST");
  expect(JSON.parse(String(captured.body))).toEqual({ prompt: "go" });
  expect(result.id).toBe("run-1");
});

it("posts resume to the run's resume endpoint", async () => {
  let calledUrl = "";
  let method = "";
  const fetchMock: typeof fetch = async (input, init) => {
    calledUrl = String(input);
    method = String(init?.method);
    return jsonResponse(RUN);
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });
  const result = await client.resumeRun("run-1");
  expect(calledUrl).toBe("http://localhost:4319/api/runs/run-1/resume");
  expect(method).toBe("POST");
  expect(result.id).toBe("run-1");
});

it("posts abort and parses the returned run detail", async () => {
  let calledUrl = "";
  const detail = { run: { ...RUN, status: "canceled" }, steps: [], sessions: [] };
  const fetchMock: typeof fetch = async (input) => {
    calledUrl = String(input);
    return jsonResponse(detail);
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });
  const result = await client.abortRun("run-1");
  expect(calledUrl).toBe("http://localhost:4319/api/runs/run-1/abort");
  expect(result.run.status).toBe("canceled");
});

const COMMENT = {
  id: "c1",
  review_id: "rv1",
  file_path: "src/thing.ts",
  line: 12,
  diff_sha: "sha-1",
  body: "Rename this.",
  status: "open",
  hunk_snapshot: "@@ -1 +1 @@",
  fix_requested_at: null,
};

it("fetches and parses the run diff (null diff allowed, never fabricated)", async () => {
  let calledUrl = "";
  const fetchMock: typeof fetch = async (input) => {
    calledUrl = String(input);
    return jsonResponse({
      run_id: "run-1",
      computed_at: "2026-07-05T00:00:00.000Z",
      diff: null,
    });
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });
  const result = await client.getRunDiff("run-1");
  expect(calledUrl).toBe("http://localhost:4319/api/runs/run-1/diff");
  expect(result.diff).toBeNull();
});

it("fetches the review surface and posts a pinned comment", async () => {
  const urls: string[] = [];
  let body: unknown;
  const fetchMock: typeof fetch = async (input, init) => {
    urls.push(String(input));
    if (init?.method === "POST") {
      body = JSON.parse(String(init.body));
      return jsonResponse(COMMENT, 201);
    }
    return jsonResponse({
      review: { id: "rv1", run_id: "run-1", status: "in_review" },
      comments: [COMMENT],
    });
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });

  const review = await client.getRunReview("run-1");
  expect(review.review?.status).toBe("in_review");
  expect(review.comments[0].diff_sha).toBe("sha-1");

  const created = await client.addReviewComment("run-1", {
    file_path: "src/thing.ts",
    line: 12,
    diff_sha: "sha-1",
    body: "Rename this.",
  });
  expect(created.id).toBe("c1");
  expect(urls).toEqual([
    "http://localhost:4319/api/runs/run-1/review",
    "http://localhost:4319/api/runs/run-1/review/comments",
  ]);
  expect(body).toEqual({
    file_path: "src/thing.ts",
    line: 12,
    diff_sha: "sha-1",
    body: "Rename this.",
  });
});

it("posts a fix request with the selected comment ids", async () => {
  let calledUrl = "";
  let body: unknown;
  const fetchMock: typeof fetch = async (input, init) => {
    calledUrl = String(input);
    body = JSON.parse(String(init?.body));
    return jsonResponse({ ...RUN, status: "running" });
  };
  const client = createDaemonClient({ baseUrl: "http://localhost:4319", fetch: fetchMock });
  const result = await client.requestFix("run-1", { comment_ids: ["c1", "c2"] });
  expect(calledUrl).toBe("http://localhost:4319/api/runs/run-1/review/fix");
  expect(body).toEqual({ comment_ids: ["c1", "c2"] });
  expect(result.status).toBe("running");
});

it("reads and prepares the local PR draft", async () => {
  const PR = {
    id: "pr1",
    run_id: "run-1",
    provider: "github",
    number: null,
    url: null,
    status: "draft",
    title: "First slice",
    body: null,
  };
  let lastBody: unknown;
  const fetchMock: typeof fetch = async (_input, init) => {
    if (init?.method === "POST") {
      lastBody = JSON.parse(String(init.body));
      return jsonResponse({ pull_request: PR }, 201);
    }
    return jsonResponse({ pull_request: null });
  };
  const client = createDaemonClient({ fetch: fetchMock });

  expect((await client.getPullRequest("run-1")).pull_request).toBeNull();

  const prepared = await client.preparePullRequest("run-1", { title: "First slice", body: "" });
  expect(prepared.pull_request?.status).toBe("draft");
  expect(lastBody).toEqual({ title: "First slice", body: "" });
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
  // Not valid JSON, then valid JSON that fails the envelope schema.
  expect(() => source.emit("event", "{not json")).not.toThrow();
  expect(() => source.emit("event", JSON.stringify({ nope: true }))).not.toThrow();
  source.emit("event", JSON.stringify(ENVELOPE));

  expect(parseErrors).toBe(2);
  expect(received.map((e) => e.seq)).toEqual([0]);
});
