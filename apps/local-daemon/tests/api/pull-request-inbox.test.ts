import type { PullRequestInbox } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { json, makeApiApp, post, request } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";
import { EMPTY_PULL_REQUEST_INBOX, stubGitHubService } from "../support/github.js";

let fix: TestDb;
let synced: string[];

function app() {
  return makeApiApp(fix, {
    github: stubGitHubService({
      pullRequestInbox: (projectId) => ({ ...EMPTY_PULL_REQUEST_INBOX, project_id: projectId }),
      syncPullRequestInbox: async (projectId) => {
        synced.push(projectId);
        return { ...EMPTY_PULL_REQUEST_INBOX, project_id: projectId };
      },
    }),
  });
}

beforeEach(() => {
  fix = setupTestDb("otomat-inbox-routes-");
  synced = [];
});

afterEach(() => fix.cleanup());

it("answers the inbox of the project it was asked for", async () => {
  const res = await request(app(), "/api/reviews?projectId=p1");
  expect(res.status).toBe(200);
  expect((await json<PullRequestInbox>(res)).project_id).toBe("p1");
});

it("refuses a listing that names no project rather than guessing one", async () => {
  const res = await request(app(), "/api/reviews");
  expect(res.status).toBe(400);
  expect(await json(res)).toEqual({ error: "project_required" });
});

it("reconciles on request and answers the inbox that pass produced", async () => {
  const res = await post(app(), "/api/reviews/sync", { project_id: "p1" });
  expect(res.status).toBe(200);
  expect(synced).toEqual(["p1"]);
  expect((await json<PullRequestInbox>(res)).project_id).toBe("p1");
});

it("refuses a sync request without a project", async () => {
  const res = await post(app(), "/api/reviews/sync", {});
  expect(res.status).toBe(400);
  expect(synced).toEqual([]);
});
