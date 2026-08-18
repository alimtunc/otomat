import {
  getIssueSource,
  insertIssue,
  insertIssueSource,
  upsertMirroredIssue,
  type Db,
  type IssueSourceRow,
} from "@otomat/db";
import type { LinearLifecycleSignal } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { reconcileSourceLifecycle } from "#linear/reconcile";

import { setupTestDb, seedRepository, type TestDb } from "../support/db.js";
import { seedRun } from "../support/seed.js";

let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-linear-reconcile-");
  seedRepository(t.db);
});

afterEach(() => t.cleanup());

function mirrorIssue(db: Db, id: string, identifier: string, projectId = "p1"): void {
  upsertMirroredIssue(db, {
    id,
    project_id: projectId,
    source: "linear",
    source_external_id: `L-${id}`,
    source_identifier: identifier,
    source_url: `https://linear.app/otomat/issue/${identifier}`,
    title: identifier,
    body: null,
    status: "ready",
    synced_at: "2026-08-16T10:00:00.000Z",
    source_updated_at: "2026-08-16T10:00:00.000Z",
    source_assignee_name: null,
    source_priority: 0,
    source_labels: null,
    source_state_name: null,
    source_state_color: null,
  });
}

function openWorkspace(db: Db, issueId: string, runId: string): void {
  seedRun(db, {
    runId,
    issueId,
    runStatus: "running",
    stepStatus: "running",
    sessionStatus: "active",
  });
}

function mapSource(db: Db, mapped: boolean): IssueSourceRow {
  insertIssueSource(db, {
    id: "src-1",
    project_id: "p1",
    source: "linear",
    external_team_id: "team-1",
    external_team_key: "OTO",
    external_team_name: "Otomat",
    in_progress_state_id: mapped ? "s-doing" : null,
    in_progress_state_name: mapped ? "Doing" : null,
    done_state_id: null,
    done_state_name: null,
  });
  const row = getIssueSource(db, "src-1");
  if (row === undefined) throw new Error("source src-1 was not seeded");
  return row;
}

it("asserts the run-started state only for this source's issues that still hold a workspace", async () => {
  mirrorIssue(t.db, "oto-open", "OTO-1");
  mirrorIssue(t.db, "oto-idle", "OTO-2");
  mirrorIssue(t.db, "eng-open", "ENG-7");
  insertIssue(t.db, { id: "local-open", project_id: "p1", title: "Local" });
  openWorkspace(t.db, "oto-open", "run-oto");
  openWorkspace(t.db, "eng-open", "run-eng");
  openWorkspace(t.db, "local-open", "run-local");
  const signals: LinearLifecycleSignal[] = [];

  const result = await reconcileSourceLifecycle(t.db, mapSource(t.db, true), async (signal) => {
    signals.push(signal);
  });

  expect(signals).toEqual([{ issue_id: "oto-open", phase: "in_progress", run_id: "run-oto" }]);
  expect(result).toEqual({ reconciled: 1, failed: 0 });
});

it("reports the writes Linear refused instead of counting them as reconciled", async () => {
  mirrorIssue(t.db, "oto-one", "OTO-1");
  mirrorIssue(t.db, "oto-two", "OTO-2");
  openWorkspace(t.db, "oto-one", "run-one");
  openWorkspace(t.db, "oto-two", "run-two");

  const result = await reconcileSourceLifecycle(t.db, mapSource(t.db, true), async (signal) => {
    if (signal.issue_id === "oto-two") throw new Error("Linear rejected the API key.");
  });

  expect(result).toEqual({ reconciled: 1, failed: 1 });
});

it("asserts nothing while the run-started phase is unmapped", async () => {
  mirrorIssue(t.db, "oto-open", "OTO-1");
  openWorkspace(t.db, "oto-open", "run-oto");
  const signals: LinearLifecycleSignal[] = [];

  const result = await reconcileSourceLifecycle(t.db, mapSource(t.db, false), async (signal) => {
    signals.push(signal);
  });

  expect(signals).toEqual([]);
  expect(result).toEqual({ reconciled: 0, failed: 0 });
});
