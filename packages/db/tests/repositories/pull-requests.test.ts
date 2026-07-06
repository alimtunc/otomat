import { afterEach, beforeEach, expect, it } from "vitest";

import {
  getPullRequestForRun,
  insertPullRequest,
  updatePullRequestDraft,
  updatePullRequestStatus,
} from "#db/repositories/pull-requests";

import { createTempDb, seedReviewRun, type TempDb } from "../support/temp-db.js";

let t: TempDb;

beforeEach(() => {
  t = createTempDb("otomat-pull-requests-");
  seedReviewRun(t.client.db);
});

afterEach(() => {
  t.cleanup();
});

it("stores the local PR draft and updates it in place", () => {
  const { db } = t.client;
  insertPullRequest(db, {
    id: "pr1",
    run_id: "r1",
    provider: "github",
    status: "draft",
    title: "First slice",
    body: null,
  });

  const created = getPullRequestForRun(db, "r1");
  expect(created).toMatchObject({
    id: "pr1",
    status: "draft",
    provider: "github",
    title: "First slice",
    body: null,
    number: null,
    url: null,
  });

  updatePullRequestDraft(db, "pr1", { title: "First slice, retitled", body: "Adds the loop." });
  expect(getPullRequestForRun(db, "r1")).toMatchObject({
    title: "First slice, retitled",
    body: "Adds the loop.",
    status: "draft",
  });

  updatePullRequestStatus(db, "pr1", "open");
  expect(getPullRequestForRun(db, "r1")?.status).toBe("open");
});
