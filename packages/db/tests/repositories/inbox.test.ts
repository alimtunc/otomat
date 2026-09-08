import { afterEach, beforeEach, expect, it } from "vitest";

import { schema } from "#db/index";
import {
  listInboxMarks,
  listInboxPullRequestEvidence,
  upsertInboxMarks,
} from "#db/repositories/inbox";
import { insertPullRequest } from "#db/repositories/pull-requests";

import { createTempDb, seedProject, type TempDb } from "../support/temp-db.js";

let t: TempDb;

beforeEach(() => {
  t = createTempDb("otomat-inbox-");
  seedProject(t.client.db);
  t.client.db
    .insert(schema.repositories)
    .values({ id: "repo-1", project_id: "p1", name: "R", default_branch: "main" })
    .run();
});

afterEach(() => {
  t.cleanup();
});

function seedPullRequest(id: string, number: number, status: "open" | "merged" | "closed"): void {
  insertPullRequest(t.client.db, {
    id,
    repository_id: "repo-1",
    number,
    url: `https://github.com/acme/repo/pull/${number}`,
    status,
    title: `feat: ${id}`,
  });
}

it("reads the live pull requests with the project that anchors them", () => {
  seedPullRequest("pr-open", 1, "open");

  expect(listInboxPullRequestEvidence(t.client.db)).toEqual([
    expect.objectContaining({
      pull_request_id: "pr-open",
      project_id: "p1",
      project_name: "P",
      issue: null,
    }),
  ]);
});

it("leaves a settled pull request out rather than projecting it away later", () => {
  seedPullRequest("pr-merged", 2, "merged");
  seedPullRequest("pr-closed", 3, "closed");

  expect(listInboxPullRequestEvidence(t.client.db)).toEqual([]);
});

const STAMP = "2026-08-22T10:00:00.000Z";

it("stores a mark once per entry and lets a later reading overwrite it", () => {
  upsertInboxMarks(t.client.db, [
    { entry_id: "run:r1", read: true, archived: false, evidence_updated_at: STAMP },
  ]);
  upsertInboxMarks(t.client.db, [
    { entry_id: "run:r1", read: true, archived: true, evidence_updated_at: STAMP },
  ]);

  expect(listInboxMarks(t.client.db)).toEqual([
    { entry_id: "run:r1", read: true, archived: true, evidence_updated_at: STAMP },
  ]);
});

it("restamps the evidence a reading applies to", () => {
  const later = "2026-08-23T10:00:00.000Z";
  upsertInboxMarks(t.client.db, [
    { entry_id: "run:r1", read: true, archived: true, evidence_updated_at: STAMP },
  ]);
  upsertInboxMarks(t.client.db, [
    { entry_id: "run:r1", read: true, archived: false, evidence_updated_at: later },
  ]);

  expect(listInboxMarks(t.client.db)).toEqual([
    { entry_id: "run:r1", read: true, archived: false, evidence_updated_at: later },
  ]);
});

it("marks a bulk request as one write", () => {
  upsertInboxMarks(t.client.db, [
    { entry_id: "run:r1", read: true, archived: false, evidence_updated_at: STAMP },
    { entry_id: "pull_request:pr-1", read: true, archived: false, evidence_updated_at: STAMP },
  ]);

  expect(
    listInboxMarks(t.client.db)
      .map((mark) => mark.entry_id)
      .toSorted(),
  ).toEqual(["pull_request:pr-1", "run:r1"]);
});
