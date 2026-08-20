import { schema, type PullRequestRow } from "@otomat/db";
import { pullRequestReviewContextSchema, type PullRequestReviewContext } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { json, makeApiApp, post, request } from "../support/api.js";
import { seedRepository, setupTestDb, type TestDb } from "../support/db.js";
import { stubGitHubService } from "../support/github.js";

let fix: TestDb;
let refreshed: string[];

const ISSUE_LINK = {
  id: "i1",
  identifier: "OTO-125",
  title: "Stabilise the reviewer",
  status: "running",
} as const;

function app(issue: PullRequestReviewContext["issue"]) {
  return makeApiApp(fix, {
    github: stubGitHubService({
      pullRequestIssue: () => issue,
      refreshPullRequest: async (id) => {
        refreshed.push(id);
        // SAFETY: the route only serialises the row, and the fixture wrote a complete one.
        return seededRow();
      },
    }),
  });
}

function seededRow(): PullRequestRow {
  const row = fix.db.select().from(schema.pullRequests).all()[0];
  if (row === undefined) throw new Error("no pull request seeded");
  return row;
}

beforeEach(() => {
  fix = setupTestDb("otomat-pull-request-routes-");
  refreshed = [];
  seedRepository(fix.db);
  fix.db
    .insert(schema.pullRequests)
    .values({
      id: "pr-1",
      repository_id: "repo-1",
      provider: "github",
      origin: "imported",
      provenance: "external",
      author_login: "contrib",
      number: 7,
      url: "https://github.com/acme/otomat/pull/7",
      status: "open",
      publication_status: "created",
      title: "Contributor fix",
      head_ref: "contrib/fix",
      base_ref: "main",
      head_sha: "head-sha",
    })
    .run();
});

afterEach(() => fix.cleanup());

it("answers the reviewer with the pull request and the issue resolved for it", async () => {
  const res = await request(
    app({ ...ISSUE_LINK, evidence: "reference" }),
    "/api/pull-requests/pr-1",
  );

  expect(res.status).toBe(200);
  const body = await json<PullRequestReviewContext>(res);
  expect(pullRequestReviewContextSchema.safeParse(body)).toMatchObject({ success: true });
  expect(body.pull_request.id).toBe("pr-1");
  expect(body.issue).toEqual({ ...ISSUE_LINK, evidence: "reference" });
});

it("says so honestly when no evidence resolves an issue", async () => {
  const res = await request(app(null), "/api/pull-requests/pr-1");

  expect((await json<PullRequestReviewContext>(res)).issue).toBeNull();
});

it("answers a reconciliation with the same shape the reviewer already reads", async () => {
  const res = await post(
    app({ ...ISSUE_LINK, evidence: "attachment" }),
    "/api/pull-requests/pr-1/refresh",
    {},
  );

  expect(res.status).toBe(200);
  expect(refreshed).toEqual(["pr-1"]);
  const body = await json<PullRequestReviewContext>(res);
  expect(pullRequestReviewContextSchema.safeParse(body)).toMatchObject({ success: true });
  expect(body.issue).toMatchObject({ evidence: "attachment" });
});

it("answers 404 for a pull request that is not attached here", async () => {
  const res = await request(app(null), "/api/pull-requests/pr-missing");

  expect(res.status).toBe(404);
  expect(await json(res)).toEqual({ error: "pull_request_not_found" });
});
