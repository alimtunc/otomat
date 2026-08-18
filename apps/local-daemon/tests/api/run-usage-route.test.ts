import { schema } from "@otomat/db";
import type { RunUsageResponse } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { makeApiApp, request } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";
import { seedRun } from "../support/seed.js";

const RUN_ID = "run-usage";
const STEP_ID = `${RUN_ID}-step`;
const SESSION_ID = `${RUN_ID}-session`;

let t: TestDb;

function reportUsage(seq: number, usage: Record<string, unknown>): void {
  t.db
    .insert(schema.runtimeEvents)
    .values({
      id: `usage-${seq}`,
      run_id: RUN_ID,
      step_run_id: STEP_ID,
      agent_session_id: SESSION_ID,
      seq,
      type: "runtime.usage",
      source: "claude",
      occurred_at: "2026-08-16T00:00:00.000Z",
      payload: { usage },
      raw_ref: null,
    })
    .run();
}

async function readUsage(): Promise<RunUsageResponse> {
  const res = await request(makeApiApp(t), `/api/runs/${RUN_ID}/usage`);
  expect(res.status).toBe(200);
  return (await res.json()) as RunUsageResponse;
}

function seed(live: boolean): void {
  seedRun(t.db, {
    runId: RUN_ID,
    runStatus: live ? "running" : "completed",
    stepStatus: live ? "running" : "succeeded",
    sessionStatus: live ? "active" : "terminated",
  });
}

beforeEach(() => {
  t = setupTestDb("otomat-run-usage-api-");
});

afterEach(() => {
  t.cleanup();
});

it("sums the run's reported turns and attributes them to their step", async () => {
  seed(false);
  reportUsage(1, { input_tokens: 100, output_tokens: 20, cost_usd: 0.01 });
  reportUsage(2, { input_tokens: 50, output_tokens: 5, cost_usd: 0.002 });

  const usage = await readUsage();

  expect(usage.total).toMatchObject({
    availability: "final",
    input_tokens: 150,
    output_tokens: 25,
    turns: 2,
  });
  expect(usage.steps).toHaveLength(1);
  expect(usage.steps[0]).toMatchObject({ step_run_id: STEP_ID, name: "Agent turn" });
  expect(usage.steps[0]?.usage.input_tokens).toBe(150);
});

it("marks a still-running scope live rather than final", async () => {
  seed(true);
  reportUsage(1, { input_tokens: 10 });

  const usage = await readUsage();

  expect(usage.total.availability).toBe("live");
  expect(usage.steps[0]?.usage.availability).toBe("live");
});

it("reports a settled scope that never answered as unavailable, not as zero", async () => {
  seed(false);

  const usage = await readUsage();

  expect(usage.total.availability).toBe("unavailable");
  expect(usage.total.input_tokens).toBeNull();
  expect(usage.total.output_tokens).toBeNull();
  expect(usage.total.cost_usd).toBeNull();
  expect(usage.total.turns).toBe(0);
});

it("keeps a field no turn reported null while summing the ones that did", async () => {
  seed(false);
  reportUsage(1, { input_tokens: 10 });

  const usage = await readUsage();

  expect(usage.total.input_tokens).toBe(10);
  expect(usage.total.cost_usd).toBeNull();
});

it("answers 404 for an unknown run", async () => {
  expect((await request(makeApiApp(t), "/api/runs/nope/usage")).status).toBe(404);
});
