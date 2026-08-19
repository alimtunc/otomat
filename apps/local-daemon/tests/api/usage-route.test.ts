import { schema } from "@otomat/db";
import type { UsageDashboard } from "@otomat/domain";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, it } from "vitest";

import { json, makeApiApp, request } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";
import { seedRun } from "../support/seed.js";

const DAY_MS = 86_400_000;
const NOW = Date.now();

let t: TestDb;
let seq = 0;

/** Always in the past, and always inside one UTC day whatever hour the suite runs at. */
function atUtc(daysAgo: number, hour: number): string {
  const date = new Date(NOW - daysAgo * DAY_MS);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
}

const DAY_A = atUtc(2, 6);
const DAY_B = atUtc(4, 6);
const LONG_AGO = atUtc(40, 6);

function reportUsage(runId: string, occurredAt: string, payload: Record<string, unknown>): void {
  seq += 1;
  t.db
    .insert(schema.runtimeEvents)
    .values({
      id: `${runId}-usage-${seq}`,
      run_id: runId,
      step_run_id: `${runId}-step`,
      agent_session_id: `${runId}-session`,
      seq,
      type: "runtime.usage",
      source: "claude",
      occurred_at: occurredAt,
      payload: { fidelity: "native", ...payload },
      raw_ref: null,
    })
    .run();
}

async function readUsage(query = ""): Promise<UsageDashboard> {
  const res = await request(makeApiApp(t), `/api/usage${query}`);
  expect(res.status).toBe(200);
  return await json<UsageDashboard>(res);
}

function seedLedger(): void {
  t.db.insert(schema.projects).values({ id: "p2", name: "Second", root_path: "/tmp/p2" }).run();
  t.db.insert(schema.issues).values({ id: "i2", project_id: "p2", title: "Other" }).run();
  t.db
    .update(schema.issues)
    .set({ source_identifier: "OTO-1" })
    .where(eq(schema.issues.id, "i1"))
    .run();

  for (const runId of ["run-a", "run-b", "run-c", "run-old"]) {
    seedRun(t.db, {
      runId,
      issueId: runId === "run-b" ? "i2" : "i1",
      runStatus: "completed",
      stepStatus: "succeeded",
      sessionStatus: "terminated",
    });
  }
  t.db
    .update(schema.runs)
    .set({ started_at: atUtc(2, 5), completed_at: atUtc(2, 8) })
    .where(eq(schema.runs.id, "run-a"))
    .run();

  reportUsage("run-a", DAY_A, {
    adapter: "claude",
    usage: { model: "claude-opus-5", input_tokens: 100, output_tokens: 20, cost_usd: 0.01 },
  });
  reportUsage("run-a", atUtc(2, 7), {
    adapter: "claude",
    usage: { model: "claude-opus-5", input_tokens: 50, output_tokens: 5 },
  });
  reportUsage("run-b", DAY_B, {
    adapter: "codex",
    usage: { input_tokens: 10, output_tokens: 2 },
  });
  reportUsage("run-c", DAY_A, { adapter: "claude", usage: "the provider wrote a sentence" });
  reportUsage("run-old", LONG_AGO, {
    adapter: "claude",
    usage: { model: "claude-opus-5", input_tokens: 999, output_tokens: 999 },
  });
}

beforeEach(() => {
  seq = 0;
  t = setupTestDb("otomat-usage-dashboard-");
  seedLedger();
});

afterEach(() => {
  t.cleanup();
});

it("totals exactly what the window's turns reported", async () => {
  const usage = await readUsage();

  expect(usage.totals.figures.input_tokens).toEqual({ value: 160, reported_turns: 3 });
  expect(usage.totals.figures.output_tokens).toEqual({ value: 27, reported_turns: 3 });
  expect(usage.totals.figures.turns).toBe(4);
  expect(usage.totals.runs).toBe(3);
  expect(usage.totals.steps).toBe(3);
});

it("keeps a partially reported metric partial instead of completing it", async () => {
  const usage = await readUsage();

  expect(usage.totals.figures.cost_usd).toEqual({ value: 0.01, reported_turns: 1 });
});

it("counts a turn whose payload cannot be read instead of dropping or zeroing it", async () => {
  const usage = await readUsage();

  expect(usage.totals.figures.unreadable_turns).toBe(1);
  const unreadableRun = usage.runs.find((row) => row.run_id === "run-c");
  expect(unreadableRun?.figures.input_tokens).toEqual({ value: null, reported_turns: 0 });
});

it("leaves a metric no turn reported null rather than zero", async () => {
  const usage = await readUsage("?projects=p2");

  expect(usage.totals.figures.cost_usd).toEqual({ value: null, reported_turns: 0 });
  expect(usage.totals.figures.input_tokens.value).toBe(10);
});

it("excludes what falls outside the period and includes it again over all time", async () => {
  expect((await readUsage("?period=30d")).totals.figures.input_tokens.value).toBe(160);

  const all = await readUsage("?period=all");

  expect(all.totals.figures.input_tokens.value).toBe(1159);
  expect(all.range.from).toBeNull();
});

it("narrows every aggregate to the selected model while keeping the options open", async () => {
  const usage = await readUsage("?models=claude-opus-5");

  expect(usage.totals.figures.input_tokens.value).toBe(150);
  expect(usage.runs.map((row) => row.run_id)).toEqual(["run-a"]);
  expect(usage.options.emitters).toEqual([
    { runtime: "claude", model: null },
    { runtime: "claude", model: "claude-opus-5" },
    { runtime: "codex", model: null },
  ]);
});

it("filters the runs of one day down to that day's turns", async () => {
  const usage = await readUsage(`?day=${DAY_A.slice(0, 10)}`);

  expect(usage.daily).toHaveLength(1);
  expect(usage.runs.map((row) => row.run_id).toSorted()).toEqual(["run-a", "run-c"]);
});

it("keeps a run reachable with the identity that reported it", async () => {
  const usage = await readUsage();
  const run = usage.runs.find((row) => row.run_id === "run-a");

  expect(run).toMatchObject({
    issue_id: "i1",
    issue_identifier: "OTO-1",
    project_name: "P",
    duration_ms: 3 * 60 * 60 * 1000,
    emitters: [{ runtime: "claude", model: "claude-opus-5" }],
  });
});

it("breaks the window down by day, project and emitter", async () => {
  const usage = await readUsage();

  expect(usage.daily.map((bucket) => bucket.day)).toEqual(
    [DAY_B.slice(0, 10), DAY_A.slice(0, 10)].toSorted(),
  );
  expect(usage.projects.map((bucket) => bucket.project_id)).toEqual(["p1", "p2"]);
  expect(usage.emitters[0]?.emitter).toEqual({ runtime: "claude", model: "claude-opus-5" });
});

it("counts a run without both boundary stamps as unmeasured rather than instant", async () => {
  const usage = await readUsage();

  expect(usage.totals.duration).toEqual({
    total_ms: 3 * 60 * 60 * 1000,
    measured_runs: 1,
    unmeasured_runs: 2,
  });
});
