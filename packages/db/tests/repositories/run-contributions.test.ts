import { afterEach, beforeEach, expect, it } from "vitest";

import type { Db } from "#db/client";
import { insertAgentSession } from "#db/repositories/agent/sessions";
import { insertIssue } from "#db/repositories/issues";
import {
  appendRunContribution,
  claimRunContributions,
  listClaimedRunContributions,
  listRunContributions,
  listRunContributionsByStatus,
  listRunContributionsForSession,
  markRunContributionsFailed,
  markRunContributionsSent,
  markRunContributionsSettled,
  releaseRunContributionClaim,
  requeueRunContribution,
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
  insertAgentSession(db, { id: `${runId}-session`, step_run_id: `${runId}-step` });
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
  appendRunContribution(t.client.db, { id: "c1", run_id: "r1", body: "first" });
  appendRunContribution(t.client.db, { id: "c2", run_id: "r1", body: "second" });
  const other = appendRunContribution(t.client.db, { id: "c3", run_id: "r2", body: "other run" });

  expect(listRunContributions(t.client.db, "r1").map((row) => [row.seq, row.body])).toEqual([
    [0, "first"],
    [1, "second"],
  ]);
  expect(other.seq).toBe(0);
});

it("starts every message queued, undelivered and unattempted", () => {
  const row = appendRunContribution(t.client.db, { id: "c1", run_id: "r1", body: "hello" });
  expect(row).toMatchObject({
    status: "queued",
    delivered_at: null,
    settled_at: null,
    agent_session_id: null,
    attempts: 0,
    error: null,
  });
});

it("records a claim without leaving `queued`, and counts the attempt", () => {
  appendRunContribution(t.client.db, { id: "c1", run_id: "r1", body: "hello" });
  markRunContributionsFailed(t.client.db, ["c1"], "no session");
  claimRunContributions(t.client.db, ["c1"], "r1-session");

  const claimed = listClaimedRunContributions(t.client.db);
  expect(claimed.map((row) => row.id)).toEqual([]);

  requeueRunContribution(t.client.db, "c1");
  claimRunContributions(t.client.db, ["c1"], "r1-session");
  const [row] = listClaimedRunContributions(t.client.db);
  expect(row).toMatchObject({ status: "queued", agent_session_id: "r1-session", error: null });
  expect(row?.attempts).toBe(2);
});

it("marks a claimed batch sent, then settles it from the carrying turn", () => {
  appendRunContribution(t.client.db, { id: "c1", run_id: "r1", body: "one" });
  appendRunContribution(t.client.db, { id: "c2", run_id: "r1", body: "two" });
  claimRunContributions(t.client.db, ["c1", "c2"], "r1-session");
  markRunContributionsSent(t.client.db, ["c1", "c2"], "2026-07-25T10:00:00.000Z");

  expect(
    listRunContributionsForSession(t.client.db, "r1-session").map((row) => row.status),
  ).toEqual(["sent", "sent"]);

  markRunContributionsSettled(t.client.db, ["c1", "c2"], "completed", "2026-07-25T10:01:00.000Z");
  const rows = listRunContributions(t.client.db, "r1");
  expect(rows.map((row) => row.status)).toEqual(["completed", "completed"]);
  expect(rows.every((row) => row.settled_at === "2026-07-25T10:01:00.000Z")).toBe(true);
});

it("drops the claim on a failure so nothing points at a turn that never ran", () => {
  appendRunContribution(t.client.db, { id: "c1", run_id: "r1", body: "one" });
  claimRunContributions(t.client.db, ["c1"], "r1-session");
  markRunContributionsFailed(t.client.db, ["c1"], "spawn failed");

  const [row] = listRunContributions(t.client.db, "r1");
  expect(row).toMatchObject({
    status: "failed",
    agent_session_id: null,
    delivered_at: null,
    error: "spawn failed",
  });
});

it("returns a released claim to the queue and clears its settled evidence on requeue", () => {
  appendRunContribution(t.client.db, { id: "c1", run_id: "r1", body: "one" });
  claimRunContributions(t.client.db, ["c1"], "r1-session");
  releaseRunContributionClaim(t.client.db, "c1");
  expect(listRunContributionsByStatus(t.client.db, "r1", "queued")[0]?.agent_session_id).toBeNull();

  markRunContributionsSent(t.client.db, ["c1"], "2026-07-25T10:00:00.000Z");
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
