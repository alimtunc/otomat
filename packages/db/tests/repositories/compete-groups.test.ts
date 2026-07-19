import { afterEach, beforeEach, expect, it } from "vitest";

import { schema } from "#db/index";
import {
  claimCompeteWinner,
  CompeteWinnerConflictError,
  getCompeteGroup,
  insertCompeteGroup,
  listCompeteGroupsForRun,
  updateCompeteGroupBase,
  updateCompeteGroupStatus,
} from "#db/repositories/compete-groups";
import { insertStepRun } from "#db/repositories/step-runs";

import { createTempDb, seedProject, type TempDb } from "../support/temp-db.js";

let t: TempDb;

beforeEach(() => {
  t = createTempDb("otomat-compete-groups-");
  seedProject(t.client.db);
  t.client.db
    .insert(schema.issues)
    .values({ id: "i1", project_id: "p1", title: "Issue", status: "ready" })
    .run();
  t.client.db
    .insert(schema.runs)
    .values({
      id: "r1",
      issue_id: "i1",
      status: "running",
      branch: "otomat/run/r1",
      plan_json: { version: 1, steps: [] },
    })
    .run();
});

afterEach(() => t.cleanup());

function seedReadyGroup(): void {
  insertCompeteGroup(t.client.db, {
    id: "g1",
    run_id: "r1",
    idx: 0,
    name: "Implementation",
    status: "awaiting_selection",
  });
  for (const [index, id] of ["candidate-a", "candidate-b"].entries()) {
    insertStepRun(t.client.db, {
      id,
      run_id: "r1",
      idx: index,
      name: id,
      status: "succeeded",
      compete_group_id: "g1",
    });
  }
}

it("stores group lifecycle and canonical base", () => {
  insertCompeteGroup(t.client.db, {
    id: "g1",
    run_id: "r1",
    idx: 0,
    name: "Implementation",
  });

  updateCompeteGroupBase(t.client.db, "g1", "abc123");
  updateCompeteGroupStatus(t.client.db, "g1", "running");

  expect(getCompeteGroup(t.client.db, "g1")).toMatchObject({
    base_head_sha: "abc123",
    status: "running",
    winner_step_run_id: null,
  });
  expect(listCompeteGroupsForRun(t.client.db, "r1").map((group) => group.id)).toEqual(["g1"]);
});

it("claims exactly one succeeded candidate and repeats the same choice idempotently", () => {
  seedReadyGroup();

  expect(claimCompeteWinner(t.client.db, "g1", "candidate-a")).toMatchObject({
    status: "promoting",
    winner_step_run_id: "candidate-a",
  });
  expect(claimCompeteWinner(t.client.db, "g1", "candidate-a")).toMatchObject({
    status: "promoting",
    winner_step_run_id: "candidate-a",
  });
  expect(() => claimCompeteWinner(t.client.db, "g1", "candidate-b")).toThrow(
    CompeteWinnerConflictError,
  );
});

it("rejects a candidate outside the group or without a succeeded result", () => {
  seedReadyGroup();
  insertStepRun(t.client.db, {
    id: "failed-candidate",
    run_id: "r1",
    idx: 2,
    name: "failed",
    status: "failed",
    compete_group_id: "g1",
  });

  expect(() => claimCompeteWinner(t.client.db, "g1", "failed-candidate")).toThrow(
    CompeteWinnerConflictError,
  );
  expect(() => claimCompeteWinner(t.client.db, "g1", "missing")).toThrow(
    CompeteWinnerConflictError,
  );
});
