import type { RunCompletionReportResponse } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { json, makeApiApp, request } from "#test-support/api";
import { setupTestDb, type TestDb } from "#test-support/db";
import { seedRun } from "#test-support/seed";

let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-completion-report-route-");
});

afterEach(() => {
  t.cleanup();
});

it("serves the deterministic completion report", async () => {
  seedRun(t.db, {
    runId: "run-report",
    runStatus: "canceled",
    stepStatus: "canceled",
    sessionStatus: "terminated",
  });

  const response = await request(makeApiApp(t), "/api/runs/run-report/report");
  expect(response.status).toBe(200);
  const body = await json<RunCompletionReportResponse>(response);
  expect(body.report.run).toMatchObject({
    status: "canceled",
    outcome: "canceled",
    terminal: true,
  });
  expect(body.report.diff.state).toBe("not_reported");
  expect(body.markdown).toContain("Result: canceled");
});

it("does not route a corrupt plan through the strict run guard", async () => {
  seedRun(t.db, {
    runId: "run-report",
    runStatus: "failed",
    stepStatus: "stale",
    sessionStatus: "failed",
  });
  t.client.sqlite
    .prepare("UPDATE runs SET plan_json = ? WHERE id = ?")
    .run(JSON.stringify({ invalid: true }), "run-report");

  const response = await request(makeApiApp(t), "/api/runs/run-report/report");
  expect(response.status).toBe(200);
  expect((await json<RunCompletionReportResponse>(response)).report.plan.state).toBe("corrupt");
});

it("returns 404 for an unknown run report", async () => {
  expect((await request(makeApiApp(t), "/api/runs/missing/report")).status).toBe(404);
});
