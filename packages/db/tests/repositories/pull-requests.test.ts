import { afterEach, beforeEach, expect, it } from "vitest";

import {
  getPullRequestForRun,
  insertPullRequest,
  updatePullRequest,
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

it("stores publication metadata and updates one row in place", () => {
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
    publication_status: "not_configured",
    head_ref: null,
    base_ref: null,
    published_head_sha: null,
    published_diff_sha: null,
    error_code: null,
    error_message: null,
  });

  updatePullRequest(db, "pr1", {
    title: "First slice, retitled",
    body: "Adds the loop.",
    status: "open",
    publication_status: "created",
    number: 42,
    url: "https://github.com/acme/repo/pull/42",
    head_ref: "otomat/run/r1",
    base_ref: "main",
    published_head_sha: "abc123",
    published_diff_sha: "diff123",
    error_code: null,
    error_message: null,
  });
  expect(getPullRequestForRun(db, "r1")).toMatchObject({
    title: "First slice, retitled",
    body: "Adds the loop.",
    status: "open",
    publication_status: "created",
    number: 42,
    url: "https://github.com/acme/repo/pull/42",
    head_ref: "otomat/run/r1",
    base_ref: "main",
    published_head_sha: "abc123",
    published_diff_sha: "diff123",
  });
});

it("enforces one pull request row per run", () => {
  const { db } = t.client;
  insertPullRequest(db, { id: "pr1", run_id: "r1", title: "First" });

  expect(() => insertPullRequest(db, { id: "pr2", run_id: "r1", title: "Duplicate" })).toThrow();
});
