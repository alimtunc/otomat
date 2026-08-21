import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";

import { seedPreview } from "./seed.mjs";

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length === 0 ? null : JSON.parse(Buffer.concat(chunks).toString());
}

function daemonStub(issues) {
  const calls = [];
  const launches = [];
  const runs = new Map();
  const server = createServer(async (req, res) => {
    calls.push(`${req.method} ${req.url}`);
    const body = await readJson(req);
    const json = (payload) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
    };
    const runId = req.url.match(/^\/api\/runs\/([^/]+)/)?.[1];
    if (req.url === "/api/health") return json({ status: "ok" });
    if (req.url === "/api/projects") return json([{ id: "local-default" }]);
    if (req.url === "/api/issues") {
      if (req.method === "GET") return json(issues);
      const id = `issue-${issues.length + 1}`;
      issues.push({ id });
      return json({ id });
    }
    if (req.url === "/api/runs") {
      const id = `run-${runs.size + 1}`;
      launches.push(body);
      runs.set(id, "review_ready");
      return json({ run: { id, status: "running" } });
    }
    if (runId !== undefined) {
      if (req.url.endsWith("/abort")) runs.set(runId, "canceled");
      return json({ run: { id: runId, status: runs.get(runId) } });
    }
    if (req.method === "PATCH") return json({ status: body.status });
    res.writeHead(404).end();
  });
  return { server, calls, launches, runs };
}

async function withStub(issues, run) {
  const stub = daemonStub(issues);
  await new Promise((resolve) => stub.server.listen(0, "127.0.0.1", resolve));
  const { port } = stub.server.address();
  try {
    return await run({ ...stub, baseUrl: `http://127.0.0.1:${port}/api` });
  } finally {
    await new Promise((resolve) => stub.server.close(resolve));
  }
}

test("fills an empty database with issues, a settled run and an aborted one", async () => {
  await withStub([], async ({ baseUrl, calls, launches, runs }) => {
    const result = await seedPreview({ baseUrl, healthTimeoutMs: 2_000, runTimeoutMs: 5_000 });

    assert.deepEqual(result, { seeded: 4, reason: null });
    assert.equal(calls.filter((call) => call === "POST /api/issues").length, 4);
    assert.equal(launches.length, 2);
    assert.equal([...runs.values()].filter((status) => status === "canceled").length, 1);
    assert.equal(calls.filter((call) => call.startsWith("PATCH /api/issues/")).length, 2);
  });
});

test("launches every seeded run on the simulated runtime, never on a provider", async () => {
  await withStub([], async ({ baseUrl, launches }) => {
    await seedPreview({ baseUrl, healthTimeoutMs: 2_000, runTimeoutMs: 5_000 });

    for (const launch of launches) assert.equal(launch.runtime, "fake");
  });
});

test("leaves a database that already holds issues untouched", async () => {
  await withStub([{ id: "existing" }], async ({ baseUrl, calls }) => {
    const result = await seedPreview({ baseUrl, healthTimeoutMs: 2_000, runTimeoutMs: 5_000 });

    assert.deepEqual(result, { seeded: 0, reason: "issues_exist" });
    assert.equal(calls.filter((call) => call.startsWith("POST /api/")).length, 0);
  });
});

test("fails loudly when no daemon ever answers", async () => {
  await assert.rejects(
    seedPreview({ baseUrl: "http://127.0.0.1:1/api", healthTimeoutMs: 300, runTimeoutMs: 300 }),
    /health/,
  );
});
