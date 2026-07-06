import type { RunPlan } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import type { DbClient } from "#db/client";
import { schema } from "#db/index";
import { insertIssue } from "#db/repositories/issues";
import { getRun, insertRun, listActiveRuns, listRuns } from "#db/repositories/runs";

import { createTempDb, seedProject, type TempDb } from "../support/temp-db.js";

let t: TempDb;

beforeEach(() => {
  t = createTempDb("otomat-runs-");
});

afterEach(() => {
  t.cleanup();
});

it("stores and parses the frozen run plan_json", () => {
  seedProject(t.client.db);
  insertIssue(t.client.db, {
    id: "i1",
    project_id: "p1",
    title: "Foundation",
    source: "local",
  });

  const plan: RunPlan = {
    version: 1,
    steps: [{ id: "s1", name: "scaffold", agent: null, prompt: null, depends_on: [] }],
  };
  insertRun(t.client.db, {
    id: "r1",
    issue_id: "i1",
    status: "queued",
    branch: "alimtunc/oto-5",
    plan_json: plan,
  });

  const run = getRun(t.client.db, "r1");
  expect(run?.plan_json).toEqual(plan);
});

function seedRunPair(db: DbClient["db"]): void {
  seedProject(db);
  insertIssue(db, { id: "i1", project_id: "p1", title: "I", source: "local" });
  insertRun(db, {
    id: "good",
    issue_id: "i1",
    status: "running",
    branch: "b1",
    plan_json: { version: 1, steps: [] },
  });
  db.insert(schema.runs)
    .values({
      id: "corrupt",
      issue_id: "i1",
      status: "running",
      branch: "b2",
      plan_json: { nope: true },
    })
    .run();
}

it("listActiveRuns returns a corrupt plan_json row separately so reconciliation can settle it", () => {
  seedRunPair(t.client.db);
  const active = listActiveRuns(t.client.db);
  expect(active.runs.map((r) => r.id)).toEqual(["good"]);
  expect(active.corrupt.map((r) => r.id)).toEqual(["corrupt"]);
  expect(active.corrupt[0]?.status).toBe("running");
});

it("listRuns fails loud on a corrupt plan_json instead of hiding the run", () => {
  seedRunPair(t.client.db);
  expect(() => listRuns(t.client.db)).toThrow();
});
