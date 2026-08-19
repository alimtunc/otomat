import { afterEach, beforeEach, expect, it } from "vitest";

import { schema } from "#db/index";
import { listUsageRuns, listUsageTurns } from "#db/repositories/usage";

import { createTempDb, seedReviewRun, type TempDb } from "../support/temp-db.js";

const WINDOW = { from: "2026-08-01T00:00:00.000Z", to: "2026-08-31T00:00:00.000Z" };

let t: TempDb;
let seq = 0;

function reportUsage(occurredAt: string, payload: Record<string, unknown>, step = "s1"): void {
  seq += 1;
  t.client.db
    .insert(schema.runtimeEvents)
    .values({
      id: `e${seq}`,
      run_id: "r1",
      step_run_id: step,
      agent_session_id: null,
      seq,
      type: "runtime.usage",
      source: "claude",
      occurred_at: occurredAt,
      payload,
      raw_ref: null,
    })
    .run();
}

beforeEach(() => {
  seq = 0;
  t = createTempDb("otomat-usage-repo-");
  seedReviewRun(t.client.db);
  for (const id of ["s1", "s2"]) {
    t.client.db
      .insert(schema.stepRuns)
      .values({ id, run_id: "r1", idx: seq++, name: id, status: "succeeded" })
      .run();
  }
  seq = 0;
});

afterEach(() => {
  t.cleanup();
});

it("groups a run's turns by step, UTC day and emitter", () => {
  reportUsage("2026-08-10T23:30:00.000Z", { adapter: "claude", usage: { input_tokens: 5 } });
  reportUsage("2026-08-11T00:30:00.000Z", { adapter: "claude", usage: { input_tokens: 7 } });
  reportUsage("2026-08-11T01:30:00.000Z", { adapter: "claude", usage: { input_tokens: 9 } }, "s2");

  const rows = listUsageTurns(t.client.db, WINDOW).toSorted((a, b) =>
    `${a.day}${a.step_run_id}`.localeCompare(`${b.day}${b.step_run_id}`),
  );

  expect(rows.map((row) => [row.day, row.step_run_id, row.input_tokens])).toEqual([
    ["2026-08-10", "s1", 5],
    ["2026-08-11", "s1", 7],
    ["2026-08-11", "s2", 9],
  ]);
  expect(rows[2].last_occurred_at).toBe("2026-08-11T01:30:00.000Z");
});

it("refuses a non-numeric figure instead of coercing it to a zero", () => {
  reportUsage("2026-08-10T10:00:00.000Z", {
    adapter: "claude",
    usage: { input_tokens: "a lot", output_tokens: 3 },
  });

  const [row] = listUsageTurns(t.client.db, WINDOW);

  expect(row.input_tokens).toBeNull();
  expect(row.input_turns).toBe(0);
  expect(row.output_tokens).toBe(3);
  expect(row.unreadable_turns).toBe(0);
});

it("refuses a negative figure the same way, rather than subtracting it from a total", () => {
  reportUsage("2026-08-10T10:00:00.000Z", {
    adapter: "claude",
    usage: { input_tokens: -5, output_tokens: 3 },
  });

  const [row] = listUsageTurns(t.client.db, WINDOW);

  expect(row.input_tokens).toBeNull();
  expect(row.input_turns).toBe(0);
  expect(row.output_tokens).toBe(3);
});

it("counts a payload carrying no usage object as unreadable", () => {
  reportUsage("2026-08-10T10:00:00.000Z", { adapter: "claude" });

  const [row] = listUsageTurns(t.client.db, WINDOW);

  expect(row).toMatchObject({ turns: 1, unreadable_turns: 1, runtime: "claude", model: null });
});

it("reads the whole ledger when the window has no lower bound", () => {
  reportUsage("2019-01-01T10:00:00.000Z", { adapter: "claude", usage: { input_tokens: 4 } });

  expect(listUsageTurns(t.client.db, WINDOW)).toHaveLength(0);
  expect(listUsageTurns(t.client.db, { from: null, to: WINDOW.to })).toHaveLength(1);
});

it("names only the runs that reported inside the window", () => {
  reportUsage("2026-08-10T10:00:00.000Z", { adapter: "claude", usage: { input_tokens: 4 } });

  expect(listUsageRuns(t.client.db, WINDOW)).toEqual([
    {
      run_id: "r1",
      status: "review_ready",
      started_at: null,
      completed_at: null,
      project_id: "p1",
      project_name: "P",
      issue_id: "i1",
      issue_identifier: null,
      issue_title: "Issue",
    },
  ]);
  expect(listUsageRuns(t.client.db, { from: "2026-08-20T00:00:00.000Z", to: WINDOW.to })).toEqual(
    [],
  );
});

it("ignores every event that is not a reported turn", () => {
  reportUsage("2026-08-10T10:00:00.000Z", { adapter: "claude", usage: { input_tokens: 4 } });
  seq += 1;
  t.client.db
    .insert(schema.runtimeEvents)
    .values({
      id: "other",
      run_id: "r1",
      step_run_id: "s1",
      agent_session_id: null,
      seq,
      type: "runtime.message",
      source: "claude",
      occurred_at: "2026-08-10T11:00:00.000Z",
      payload: { adapter: "claude", usage: { input_tokens: 1000 } },
      raw_ref: null,
    })
    .run();

  expect(listUsageTurns(t.client.db, WINDOW)[0].input_tokens).toBe(4);
});
