import { afterEach, beforeEach, expect, it } from "vitest";

import type { Db } from "#db/client";
import { insertAgentSession } from "#db/repositories/agent/sessions";
import { insertIssue } from "#db/repositories/issues";
import {
  appendRunContribution,
  cancelRunContribution,
  claimRunContributions,
  failRunContributionDelivery,
  listClaimableRunContributions,
  listClaimableStepContributions,
  listClaimedRunContributions,
  listRunContributions,
  listRunContributionsForSession,
  markRunContributionsDelivered,
  markRunContributionsSettled,
  releaseRunContributionClaims,
  requeueRunContribution,
  type RunContributionRow,
} from "#db/repositories/run-contributions";
import { insertRun } from "#db/repositories/runs";
import { insertStepRun } from "#db/repositories/step-runs";

import { createTempDb, seedProject, type TempDb } from "../support/temp-db.js";

let t: TempDb;

function seedRun(db: Db, runId: string): void {
  insertIssue(db, { id: `issue-${runId}`, project_id: "p1", title: "Work", source: "local" });
  insertRun(db, {
    id: runId,
    issue_id: `issue-${runId}`,
    status: "running",
    branch: `otomat/run/${runId}`,
    plan_json: { version: 1, steps: [] },
  });
  insertStepRun(db, { id: `${runId}-step`, run_id: runId, idx: 0, name: "Agent turn" });
  insertStepRun(db, { id: `${runId}-step-2`, run_id: runId, idx: 1, name: "Follow-up" });
  insertAgentSession(db, { id: `${runId}-session`, step_run_id: `${runId}-step` });
}

function append(id: string, body: string, stepRunId = "r1-step"): RunContributionRow {
  return appendRunContribution(t.client.db, { id, run_id: "r1", step_run_id: stepRunId, body });
}

beforeEach(() => {
  t = createTempDb("otomat-run-contributions-");
  seedProject(t.client.db);
  seedRun(t.client.db, "r1");
});

afterEach(() => {
  t.cleanup();
});

it("numbers a run's messages in send order, independently per run", () => {
  seedRun(t.client.db, "r2");
  append("c1", "first");
  append("c2", "second");
  const other = appendRunContribution(t.client.db, {
    id: "c3",
    run_id: "r2",
    step_run_id: "r2-step",
    body: "other run",
  });

  expect(listRunContributions(t.client.db, "r1").map((row) => [row.seq, row.body])).toEqual([
    [0, "first"],
    [1, "second"],
  ]);
  expect(other.seq).toBe(0);
});

it("starts every message queued, undelivered and unattempted on its own step", () => {
  const row = append("c1", "hello");
  expect(row).toMatchObject({
    step_run_id: "r1-step",
    status: "queued",
    delivered_at: null,
    settled_at: null,
    agent_session_id: null,
    attempts: 0,
    error: null,
  });
});

it("scopes the claimable queue to one step, keeping run order across steps", () => {
  append("c1", "for the first step");
  append("c2", "for the second step", "r1-step-2");

  expect(listClaimableStepContributions(t.client.db, "r1-step").map((row) => row.id)).toEqual([
    "c1",
  ]);
  expect(listClaimableStepContributions(t.client.db, "r1-step-2").map((row) => row.id)).toEqual([
    "c2",
  ]);
  expect(listClaimableRunContributions(t.client.db, "r1").map((row) => row.id)).toEqual([
    "c1",
    "c2",
  ]);
});

it("hides an already-claimed message from the claimable queue, so no turn takes it twice", () => {
  append("c1", "hello");
  claimRunContributions(t.client.db, ["c1"], "r1-session");

  expect(listClaimableStepContributions(t.client.db, "r1-step")).toEqual([]);
  expect(listClaimableRunContributions(t.client.db, "r1")).toEqual([]);
});

it("records a claim without leaving `queued`, and counts the attempt", () => {
  append("c1", "hello");
  failRunContributionDelivery(t.client.db, ["c1"], "no session");
  claimRunContributions(t.client.db, ["c1"], "r1-session");

  const claimed = listClaimedRunContributions(t.client.db);
  expect(claimed.map((row) => row.id)).toEqual([]);

  requeueRunContribution(t.client.db, "c1");
  claimRunContributions(t.client.db, ["c1"], "r1-session");
  const [row] = listClaimedRunContributions(t.client.db);
  expect(row).toMatchObject({ status: "queued", agent_session_id: "r1-session", error: null });
  expect(row?.attempts).toBe(2);
});

it("marks a claimed batch delivered, then settles it from the carrying turn", () => {
  append("c1", "one");
  append("c2", "two");
  claimRunContributions(t.client.db, ["c1", "c2"], "r1-session");
  markRunContributionsDelivered(t.client.db, ["c1", "c2"], "2026-07-25T10:00:00.000Z");

  expect(
    listRunContributionsForSession(t.client.db, "r1-session").map((row) => row.status),
  ).toEqual(["delivered", "delivered"]);

  markRunContributionsSettled(
    t.client.db,
    ["c1", "c2"],
    "acknowledged",
    "2026-07-25T10:01:00.000Z",
  );
  const rows = listRunContributions(t.client.db, "r1");
  expect(rows.map((row) => row.status)).toEqual(["acknowledged", "acknowledged"]);
  expect(rows.every((row) => row.settled_at === "2026-07-25T10:01:00.000Z")).toBe(true);
});

it("drops the claim on a failure so nothing points at a turn that never ran", () => {
  append("c1", "one");
  claimRunContributions(t.client.db, ["c1"], "r1-session");
  failRunContributionDelivery(t.client.db, ["c1"], "spawn failed");

  const [row] = listRunContributions(t.client.db, "r1");
  expect(row).toMatchObject({
    status: "failed",
    agent_session_id: null,
    delivered_at: null,
    error: "spawn failed",
  });
});

it("keeps a canceled message in the conversation without inventing an error for it", () => {
  append("c1", "never mind");
  cancelRunContribution(t.client.db, "c1", "2026-07-25T10:02:00.000Z");

  expect(listRunContributions(t.client.db, "r1")[0]).toMatchObject({
    status: "canceled",
    settled_at: "2026-07-25T10:02:00.000Z",
    error: null,
    delivered_at: null,
  });
  expect(listClaimableRunContributions(t.client.db, "r1")).toEqual([]);
});

it("returns a released claim to the queue and clears its settled evidence on requeue", () => {
  append("c1", "one");
  claimRunContributions(t.client.db, ["c1"], "r1-session");
  releaseRunContributionClaims(t.client.db, ["c1"]);
  expect(listClaimableRunContributions(t.client.db, "r1")[0]?.agent_session_id).toBeNull();

  markRunContributionsDelivered(t.client.db, ["c1"], "2026-07-25T10:00:00.000Z");
  markRunContributionsSettled(t.client.db, ["c1"], "failed", "2026-07-25T10:01:00.000Z", "boom");
  requeueRunContribution(t.client.db, "c1");

  expect(listRunContributions(t.client.db, "r1")[0]).toMatchObject({
    status: "queued",
    settled_at: null,
    error: null,
    // The delivery evidence is never erased: it is what refuses a second send.
    delivered_at: "2026-07-25T10:00:00.000Z",
  });
});
