import { CORRELATION_ID_HEADER, type DaemonLogExcerpt } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { json, makeApiApp, post, request, stubSupervisor } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";

let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-diagnostics-");
});

afterEach(() => {
  t.cleanup();
});

const VALID_PLAN = {
  prompt: "goal",
  plan: {
    version: 1,
    steps: [{ id: "a", name: "A", agent: null, prompt: "pa", depends_on: [] }],
  },
};

async function excerptFor(app: ReturnType<typeof makeApiApp>, res: Response): Promise<string> {
  const correlationId = res.headers.get(CORRELATION_ID_HEADER) ?? "";
  const logs = await request(app, `/api/diagnostics/logs?correlation_id=${correlationId}`);
  const excerpt = await json<DaemonLogExcerpt>(logs);
  expect(excerpt.correlation_id).toBe(correlationId);
  for (const entry of excerpt.entries) expect(entry.correlation_id).toBe(correlationId);
  return excerpt.entries.map((entry) => entry.message).join("\n");
}

it("stamps a correlation id on every response", async () => {
  const res = await request(makeApiApp(t), "/api/health");

  expect(res.headers.get(CORRELATION_ID_HEADER)).toMatch(/^req_[0-9a-f]{12}$/);
});

it("keeps the redacted daemon stack behind an unhandled failure", async () => {
  const app = makeApiApp(t, {
    schemaMetadata: () => {
      throw new Error("schema read failed: token=ghp_abcdef123456 on /data/otomat.db");
    },
  });
  const failure = await request(app, "/api/health");
  expect(failure.status).toBe(500);

  const text = await excerptFor(app, failure);
  expect(text).toContain("GET /api/health responded 500");
  expect(text).toContain("schema read failed");
  expect(text).toContain("on /data/otomat.db");
  expect(text).not.toContain("ghp_abcdef123456");
  expect(text).toContain("[REDACTED]");
});

it("keeps the refusal a route answered with, so a handled 500 is still traceable", async () => {
  const app = makeApiApp(t, {
    supervisor: stubSupervisor({
      start: async () => {
        throw new Error("supervisor unavailable");
      },
    }),
  });
  const failure = await post(app, "/api/runs", VALID_PLAN);
  expect(failure.status).toBe(500);

  expect(await excerptFor(app, failure)).toContain(
    'POST /api/runs responded 500 {"error":"run_launch_failed"}',
  );
});

it("never returns another request's lines", async () => {
  const app = makeApiApp(t, {
    supervisor: stubSupervisor({
      start: async () => {
        throw new Error("supervisor unavailable");
      },
    }),
  });
  const first = await post(app, "/api/runs", VALID_PLAN);
  const second = await post(app, "/api/runs", VALID_PLAN);

  expect(first.headers.get(CORRELATION_ID_HEADER)).not.toBe(
    second.headers.get(CORRELATION_ID_HEADER),
  );
  expect((await excerptFor(app, second)).split("\n")).toHaveLength(1);
});

it("keeps nothing for a request that succeeded", async () => {
  const app = makeApiApp(t);

  expect(await excerptFor(app, await request(app, "/api/health"))).toBe("");
});

it("refuses to serve logs without a correlation id, so there is no unfiltered tail", async () => {
  const res = await request(makeApiApp(t), "/api/diagnostics/logs");

  expect(res.status).toBe(400);
  expect(await json<{ error: string }>(res)).toEqual({ error: "correlation_id_required" });
});
