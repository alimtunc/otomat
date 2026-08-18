import {
  getIssueSource,
  insertIssue,
  insertIssueSource,
  insertLinearWrite,
  upsertMirroredIssue,
  type Db,
  type IssueSourceLifecyclePatch,
  type IssueSourceRow,
} from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { resolveLifecycleTarget } from "#linear/lifecycle";
import { sourceLifecycleError } from "#linear/writeback/lifecycle-error";

import { setupTestDb, type TestDb } from "../support/db.js";

let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-linear-mapping-");
});

afterEach(() => t.cleanup());

function mirrorIssue(db: Db, id: string, identifier: string): void {
  upsertMirroredIssue(db, {
    id,
    project_id: "p1",
    source: "linear",
    source_external_id: `L-${id}`,
    source_identifier: identifier,
    source_url: `https://linear.app/otomat/issue/${identifier}`,
    title: identifier,
    body: null,
    status: "ready",
    synced_at: "2026-07-20T10:00:00.000Z",
    source_updated_at: "2026-07-20T10:00:00.000Z",
    source_assignee_name: null,
    source_priority: 0,
    source_labels: null,
    source_state_name: null,
    source_state_color: null,
  });
}

function mapTeam(db: Db, id: string, key: string, states: IssueSourceLifecyclePatch): void {
  insertIssueSource(db, {
    id,
    project_id: "p1",
    source: "linear",
    external_team_id: `team-${key}`,
    external_team_key: key,
    external_team_name: key,
    ...states,
  });
}

function failLifecycleWrite(
  db: Db,
  id: string,
  issueId: string,
  message: string,
  updatedAt: string,
): void {
  insertLinearWrite(db, {
    id,
    issue_id: issueId,
    run_id: null,
    kind: "lifecycle",
    status: "failed",
    idempotency_key: id,
    payload_json: { phase: "in_progress", state_id: "s-doing", state_name: "Doing" },
    detail: "Run started → Doing",
    error_code: "linear_unauthorized",
    error_message: message,
    updated_at: updatedAt,
  });
}

function sourceRow(db: Db, id: string): IssueSourceRow {
  const row = getIssueSource(db, id);
  if (row === undefined) throw new Error(`source ${id} was not seeded`);
  return row;
}

it("gives each mapped team of one project its own workflow states", () => {
  mirrorIssue(t.db, "oto", "OTO-12");
  mirrorIssue(t.db, "eng", "ENG-4");
  mapTeam(t.db, "src-oto", "OTO", {
    in_progress_state_id: "s-doing",
    in_progress_state_name: "Doing",
    done_state_id: "s-shipped",
    done_state_name: "Shipped",
  });
  mapTeam(t.db, "src-eng", "ENG", {
    in_progress_state_id: "s-wip",
    in_progress_state_name: "WIP",
    done_state_id: "s-landed",
    done_state_name: "Landed",
  });

  expect(resolveLifecycleTarget(t.db, "oto", "in_progress")).toEqual({
    id: "s-doing",
    name: "Doing",
  });
  expect(resolveLifecycleTarget(t.db, "eng", "done")).toEqual({ id: "s-landed", name: "Landed" });
});

it("resolves nothing for an unmapped phase, an unmapped team or a local issue", () => {
  mirrorIssue(t.db, "oto", "OTO-12");
  mirrorIssue(t.db, "eng", "ENG-4");
  mapTeam(t.db, "src-oto", "OTO", {
    in_progress_state_id: "s-doing",
    in_progress_state_name: "Doing",
    done_state_id: null,
    done_state_name: null,
  });
  insertIssue(t.db, { id: "local", project_id: "p1", title: "Local", source: "local" });

  expect(resolveLifecycleTarget(t.db, "oto", "done")).toBeNull();
  expect(resolveLifecycleTarget(t.db, "eng", "in_progress")).toBeNull();
  expect(resolveLifecycleTarget(t.db, "local", "in_progress")).toBeNull();
  expect(resolveLifecycleTarget(t.db, "missing", "in_progress")).toBeNull();
});

it("reports each source's own newest failed status write, and nothing when it has none", () => {
  mirrorIssue(t.db, "oto", "OTO-12");
  mirrorIssue(t.db, "eng", "ENG-4");
  const mapping = {
    in_progress_state_id: "s-doing",
    in_progress_state_name: "Doing",
    done_state_id: null,
    done_state_name: null,
  };
  mapTeam(t.db, "src-oto", "OTO", mapping);
  mapTeam(t.db, "src-eng", "ENG", mapping);
  failLifecycleWrite(t.db, "w-old", "oto", "Linear was unavailable.", "2026-08-16 09:00:00");
  failLifecycleWrite(t.db, "w-new", "oto", "Linear rejected the API key.", "2026-08-16 10:00:00");

  expect(sourceLifecycleError(t.db, sourceRow(t.db, "src-oto"))).toEqual({
    issue_id: "oto",
    write_id: "w-new",
    phase: "in_progress",
    message: "Linear rejected the API key.",
  });
  expect(sourceLifecycleError(t.db, sourceRow(t.db, "src-eng"))).toBeNull();
});
