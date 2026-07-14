import { schema } from "@otomat/db";
import type { GitHubConnectionContract, PullRequestDetail } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { GitHubPublicationError } from "#github";

import { makeApiApp, post, request } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";
import { stubGitHubService } from "../support/github.js";
import { pullRequestRow } from "../support/review.js";

const RUN_ID = "run-github-api";
let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-github-api-");
  t.db
    .insert(schema.runs)
    .values({
      id: RUN_ID,
      issue_id: "i1",
      status: "review_ready",
      branch: `otomat/run/${RUN_ID}`,
      plan_json: { version: 1, steps: [] },
    })
    .run();
});

afterEach(() => t.cleanup());

it("serves GitHub connection state and starts the delegated login", async () => {
  let connects = 0;
  const app = makeApiApp(t, {
    github: stubGitHubService({
      connection: async () => ({
        status: "connected",
        login: "octocat",
        error_code: null,
        error_message: null,
      }),
      connect: () => {
        connects += 1;
        return {
          status: "connecting",
          login: null,
          error_code: null,
          error_message: null,
        };
      },
    }),
  });

  const status = await request(app, "/api/github/connection");
  expect((await status.json()) as GitHubConnectionContract).toMatchObject({
    status: "connected",
    login: "octocat",
  });

  const connect = await post(app, "/api/github/connect", {});
  expect(connect.status).toBe(202);
  expect((await connect.json()) as GitHubConnectionContract).toMatchObject({
    status: "connecting",
  });
  expect(connects).toBe(1);
});

it("serves and publishes the durable PR through the GitHub module", async () => {
  const row = pullRequestRow({
    id: "pr1",
    run_id: RUN_ID,
    number: 42,
    url: "https://github.com/acme/otomat/pull/42",
    status: "open",
    publication_status: "created",
    head_ref: `otomat/run/${RUN_ID}`,
    base_ref: "main",
  });
  const app = makeApiApp(t, {
    github: stubGitHubService({
      getPullRequest: () => ({ row, hasUnpublishedChanges: false }),
      publish: async () => ({ row, hasUnpublishedChanges: false }),
    }),
  });

  const fetched = await request(app, `/api/runs/${RUN_ID}/pr`);
  expect(((await fetched.json()) as PullRequestDetail).pull_request).toMatchObject({
    number: 42,
    has_unpublished_changes: false,
  });

  const published = await post(app, `/api/runs/${RUN_ID}/pr`, {
    title: "Ship it",
    body: "Details",
  });
  expect(published.status).toBe(200);
  expect(((await published.json()) as PullRequestDetail).pull_request?.url).toBe(row.url);
});

it("maps an invalid run state to a conflict", async () => {
  const app = makeApiApp(t, {
    github: stubGitHubService({
      publish: async () => {
        throw new GitHubPublicationError("run_not_review_ready", "Not ready.");
      },
    }),
  });

  const response = await post(app, `/api/runs/${RUN_ID}/pr`, { title: "Ship", body: "" });
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: "run_not_review_ready" });
});
