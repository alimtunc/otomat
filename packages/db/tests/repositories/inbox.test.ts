import { afterEach, beforeEach, expect, it } from "vitest";

import { schema } from "#db/index";
import { listInboxPullRequestEvidence } from "#db/repositories/inbox";
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
