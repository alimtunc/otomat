import { insertPullRequest, updatePullRequest } from "@otomat/db";
import type { PullRequestState } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { readReviewQueue } from "#api/review-queue";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { seedRun } from "../support/seed.js";

let fix: DaemonTestDb;

function adopt(id: string, status: PullRequestState): void {
  insertPullRequest(fix.db, {
    id,
    issue_id: "i1",
    repository_id: "repo-1",
    origin: "imported",
    provenance: "external",
    number: 7,
    url: "https://github.com/acme/otomat/pull/7",
    status,
    publication_status: "created",
    title: "Contributor fix",
    head_ref: "contrib/fix",
    head_sha: "a".repeat(40),
    base_sha: "b".repeat(40),
  });
}

beforeEach(() => {
  fix = setupDaemonDb();
  seedRun(fix.db, {
    runId: "r1",
    issueId: "i1",
    runStatus: "review_ready",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
  });
});

afterEach(() => fix.cleanup());

it("lists a run resting on its diff", () => {
  expect(readReviewQueue(fix.db, "p1")).toEqual([
    {
      kind: "run",
      id: "r1",
      issue_id: "i1",
      label: "Run r1",
      branch: "otomat/run/r1",
      provenance: null,
    },
  ]);
});

it("lists an adopted pull request on its own, with its provenance", () => {
  adopt("pr-open", "open");
  expect(readReviewQueue(fix.db, "p1")).toContainEqual({
    kind: "pull_request",
    id: "pr-open",
    issue_id: "i1",
    label: "#7 Contributor fix",
    branch: "contrib/fix",
    provenance: "external",
  });
});

it("drops the run and the pull request once GitHub confirms a merge or a close", () => {
  adopt("pr-settled", "open");
  for (const status of ["merged", "closed"] as const) {
    updatePullRequest(fix.db, "pr-settled", { status });
    expect(readReviewQueue(fix.db, "p1")).toEqual([]);
  }
});
