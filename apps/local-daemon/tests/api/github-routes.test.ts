import { schema } from "@otomat/db";
import type {
  GitHubConnectionContract,
  PullRequestDetail,
  PullRequestSync,
  PushPullRequestRequest,
} from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { GitHubPublicationError } from "#github";

import { makeApiApp, post, request } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";
import { CONNECTED_GITHUB, pullRequestRow, stubGitHubService } from "../support/github.js";

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
      connection: async () => CONNECTED_GITHUB,
      connect: () => {
        connects += 1;
        return {
          status: "connecting",
          login: null,
          device_authorization: null,
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
    published_head_sha: "abc123",
    published_diff_sha: "diff123",
  });
  // The route reads "created or updated" from the stored row, so the publish below answers 200.
  t.db.insert(schema.pullRequests).values(row).run();
  const sync: PullRequestSync = {
    state: "ahead",
    dirty: true,
    local_head_sha: "abc123",
    remote_head_sha: "def456",
    ahead: [{ sha: "abc123", subject: "follow up" }],
    replaced: [],
  };
  const app = makeApiApp(t, {
    github: stubGitHubService({
      getPullRequest: async () => ({ row, sync }),
      publish: async () => ({ row, sync }),
    }),
  });

  const fetched = await request(app, `/api/runs/${RUN_ID}/pr`);
  const detail = (await fetched.json()) as PullRequestDetail;
  expect(detail.pull_request).toMatchObject({ number: 42 });
  expect(detail.sync).toEqual(sync);

  const published = await post(app, `/api/runs/${RUN_ID}/pr`, {
    title: "Ship it",
    body: "Details",
    mode: "ready",
  });
  expect(published.status).toBe(200);
  expect(((await published.json()) as PullRequestDetail).pull_request?.url).toBe(row.url);
});

it("pushes commits through the GitHub module and answers with the published comparison", async () => {
  const row = pullRequestRow({
    id: "pr1",
    run_id: RUN_ID,
    number: 42,
    url: "https://github.com/acme/otomat/pull/42",
    status: "open",
    publication_status: "created",
    head_ref: `otomat/run/${RUN_ID}`,
    base_ref: "main",
    published_head_sha: "abc123",
    published_diff_sha: "diff123",
  });
  const requests: PushPullRequestRequest[] = [];
  const app = makeApiApp(t, {
    github: stubGitHubService({
      pushCommits: async (_runId, sent) => {
        requests.push(sent);
        return {
          row,
          sync: {
            state: "in_sync",
            dirty: false,
            local_head_sha: "abc123",
            remote_head_sha: "abc123",
            ahead: [],
            replaced: [],
          },
        };
      },
    }),
  });

  const response = await post(app, `/api/runs/${RUN_ID}/pr/push`, {
    expected_remote_sha: "a".repeat(40),
  });

  expect(response.status).toBe(200);
  expect(((await response.json()) as PullRequestDetail).sync?.state).toBe("in_sync");
  expect(requests).toEqual([{ expected_remote_sha: "a".repeat(40) }]);
});

it("maps a refused push to an actionable conflict", async () => {
  const app = makeApiApp(t, {
    github: stubGitHubService({
      pushCommits: async () => {
        throw new GitHubPublicationError("github_push_rejected", "The remote branch diverged.");
      },
    }),
  });

  const response = await post(app, `/api/runs/${RUN_ID}/pr/push`, {});
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({
    error: "github_push_rejected",
    message: "The remote branch diverged.",
  });
});

it("maps a workspace that cannot publish to a conflict carrying its technical reason", async () => {
  const app = makeApiApp(t, {
    github: stubGitHubService({
      publish: async () => {
        throw new GitHubPublicationError("diff_empty", "The run has no changes to publish.");
      },
    }),
  });

  const response = await post(app, `/api/runs/${RUN_ID}/pr`, {
    title: "Ship",
    body: "",
    mode: "ready",
  });
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({
    error: "diff_empty",
    message: "The run has no changes to publish.",
  });
});

it("refuses a publication that names no mode rather than defaulting it to draft", async () => {
  const app = makeApiApp(t, { github: stubGitHubService() });

  const response = await post(app, `/api/runs/${RUN_ID}/pr`, { title: "Ship", body: "" });

  expect(response.status).toBe(400);
});

it("generates PR metadata without publishing, and surfaces generation refusals", async () => {
  const proposal = {
    title: "feat(pr): add note.md (OTO-81)",
    body: "Adds the note.\n\nFixes OTO-81",
    branch: "feat/add-note",
    commit: { subject: "feat(pr): add note.md", body: null },
    generator: { runtime: "claude", model: "claude-opus-5", effort: "high" },
  };
  let published = 0;
  const app = makeApiApp(t, {
    github: stubGitHubService({
      generatePullRequestMetadata: async () => proposal,
      publish: async () => {
        published += 1;
        throw new Error("generation must not publish");
      },
    }),
  });

  const res = await post(app, `/api/runs/${RUN_ID}/pr/generate`, {});
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual(proposal);
  expect(published).toBe(0);

  const refusing = makeApiApp(t, {
    github: stubGitHubService({
      generatePullRequestMetadata: async () => {
        throw new GitHubPublicationError(
          "pr_generator_model_unavailable",
          'The claude CLI on this host does not offer model "ghost".',
        );
      },
    }),
  });
  const refused = await post(refusing, `/api/runs/${RUN_ID}/pr/generate`, {});
  expect(refused.status).toBe(409);
  expect(await refused.json()).toEqual({
    error: "pr_generator_model_unavailable",
    message: 'The claude CLI on this host does not offer model "ghost".',
  });
});
