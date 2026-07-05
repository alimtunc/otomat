import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createClient, insertIssue, insertProject, runMigrations, type Db } from "@otomat/db";
import type {
  PullRequestDetail,
  ReviewCommentContract,
  ReviewDetail,
  RunContract,
  RunDiffResponse,
} from "@otomat/domain";
import type { Hono } from "hono";
import { afterEach, beforeEach, expect, it } from "vitest";

import { createApiApp } from "#api/app";
import type { ApiDeps } from "#api/deps";
import type { CanonicalDiff } from "#git";
import { CommentsNotFixableError, DiffUnavailableError, ReviewAnchorStaleError } from "#review";
import { RunNotResumableError } from "#supervisor";

import { commentRow, pullRequestRow, reviewRow, stubReviewService } from "../support/review.js";
import { seedRun } from "../support/seed.js";

const PROJECT_ID = "project-1";
const ISSUE_ID = "issue-1";
const RUN_ID = "run-review";

let dbPath = "";
let db: Db;
let close: () => void;

function request(
  app: Hono,
  path: string,
  init: RequestInit & { headers?: Record<string, string> } = {},
): Promise<Response> {
  return app.request(path, { ...init, headers: { Host: "127.0.0.1", ...init.headers } });
}

function post(app: Hono, path: string, body: unknown): Promise<Response> {
  return request(app, path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

interface AppOverrides {
  fixRun?: ApiDeps["fixRun"];
  review?: ApiDeps["review"];
}

function makeApp(overrides: AppOverrides = {}) {
  return createApiApp({
    db,
    name: "test-daemon",
    version: "9.9.9",
    startedAt: "2026-07-05T00:00:00.000Z",
    dbPath,
    launchRun: async () => {
      throw new Error("not under test");
    },
    resumeRun: async () => {
      throw new Error("not under test");
    },
    fixRun:
      overrides.fixRun ??
      (async () => {
        throw new Error("fixRun stub not configured");
      }),
    abortRun: async () => {},
    review: overrides.review ?? stubReviewService(),
  });
}

const DIFF: CanonicalDiff = {
  base: "base-sha",
  additions: 3,
  deletions: 1,
  sha: "diff-sha",
  files: [
    {
      path: "notes.md",
      oldPath: null,
      status: "added",
      additions: 3,
      deletions: 1,
      binary: false,
      patch: "@@ -0,0 +1,3 @@\n+alpha\n+beta\n+gamma",
      sha: "file-sha",
    },
  ],
};

beforeEach(() => {
  dbPath = join(tmpdir(), `otomat-review-api-${randomUUID()}.db`);
  runMigrations(dbPath);
  const client = createClient(dbPath);
  db = client.db;
  close = () => client.sqlite.close();
  insertProject(db, { id: PROJECT_ID, name: "Local", root_path: "/tmp/repo" });
  insertIssue(db, { id: ISSUE_ID, project_id: PROJECT_ID, title: "First issue", status: "ready" });
  seedRun(db, {
    runId: RUN_ID,
    issueId: ISSUE_ID,
    runStatus: "review_ready",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
    providerSessionId: "ps-1",
  });
});

afterEach(() => {
  close();
  for (const suffix of ["", "-shm", "-wal"]) rmSync(`${dbPath}${suffix}`, { force: true });
});

it("returns 404 on every review surface for an unknown run", async () => {
  const app = makeApp();
  for (const path of ["/diff", "/review", "/pr"]) {
    expect((await request(app, `/api/runs/nope${path}`)).status).toBe(404);
  }
});

it("serves the canonical diff mapped to the wire contract", async () => {
  const app = makeApp({
    review: stubReviewService({
      getRunDiff: () => ({ computedAt: "2026-07-05T00:00:00.000Z", diff: DIFF }),
    }),
  });
  const res = await request(app, `/api/runs/${RUN_ID}/diff`);
  expect(res.status).toBe(200);
  const body = (await res.json()) as RunDiffResponse;
  expect(body.run_id).toBe(RUN_ID);
  expect(body.diff?.sha).toBe("diff-sha");
  expect(body.diff?.files[0]).toMatchObject({ path: "notes.md", old_path: null, sha: "file-sha" });
});

it("serves an honest null diff when the run has no worktree", async () => {
  const res = await request(makeApp(), `/api/runs/${RUN_ID}/diff`);
  expect(res.status).toBe(200);
  expect(((await res.json()) as RunDiffResponse).diff).toBeNull();
});

it("serves the review surface with serialized comments", async () => {
  const app = makeApp({
    review: stubReviewService({
      getReviewDetail: () => ({ review: reviewRow(), comments: [commentRow()] }),
    }),
  });
  const res = await request(app, `/api/runs/${RUN_ID}/review`);
  const body = (await res.json()) as ReviewDetail;
  expect(body.review?.status).toBe("in_review");
  expect(body.comments[0]).toMatchObject({ id: "c1", diff_sha: "sha-1", status: "open" });
  expect(body.comments[0]).not.toHaveProperty("created_at");
});

it("creates a pinned comment and returns 201", async () => {
  let received: unknown;
  const app = makeApp({
    review: stubReviewService({
      addComment: (_run, request) => {
        received = request;
        return commentRow();
      },
    }),
  });
  const res = await post(app, `/api/runs/${RUN_ID}/review/comments`, {
    file_path: "src/thing.ts",
    line: 12,
    diff_sha: "sha-1",
    body: "Rename this.",
  });
  expect(res.status).toBe(201);
  expect(((await res.json()) as ReviewCommentContract).id).toBe("c1");
  expect(received).toEqual({
    file_path: "src/thing.ts",
    line: 12,
    diff_sha: "sha-1",
    body: "Rename this.",
  });
});

it("rejects an invalid comment body with 400", async () => {
  const res = await post(makeApp(), `/api/runs/${RUN_ID}/review/comments`, { body: "" });
  expect(res.status).toBe(400);
  expect(((await res.json()) as { error: string }).error).toBe("invalid_request");
});

it("maps stale anchors and missing diffs to 409 conflicts", async () => {
  const stale = makeApp({
    review: stubReviewService({
      addComment: () => {
        throw new ReviewAnchorStaleError("src/thing.ts");
      },
    }),
  });
  const staleRes = await post(stale, `/api/runs/${RUN_ID}/review/comments`, {
    file_path: "src/thing.ts",
    line: 1,
    diff_sha: "old",
    body: "x",
  });
  expect(staleRes.status).toBe(409);
  expect(((await staleRes.json()) as { error: string }).error).toBe("comment_anchor_stale");

  const bare = makeApp({
    review: stubReviewService({
      addComment: () => {
        throw new DiffUnavailableError(RUN_ID);
      },
    }),
  });
  const bareRes = await post(bare, `/api/runs/${RUN_ID}/review/comments`, {
    file_path: "src/thing.ts",
    line: 1,
    diff_sha: "s",
    body: "x",
  });
  expect(bareRes.status).toBe(409);
  expect(((await bareRes.json()) as { error: string }).error).toBe("diff_unavailable");
});

it("orchestrates a fix request: prepare, spawn the turn, then mark", async () => {
  const calls: string[] = [];
  let fixPrompt = "";
  let marked: string[] = [];
  const app = makeApp({
    review: stubReviewService({
      prepareFix: (_run, commentIds) => {
        calls.push("prepare");
        return { prompt: "built fix prompt", commentIds };
      },
      markFixRequested: (_runId, commentIds) => {
        calls.push("mark");
        marked = commentIds;
      },
    }),
    fixRun: async (_runId, prompt) => {
      calls.push("spawn");
      fixPrompt = prompt;
      return {
        id: RUN_ID,
        issue_id: ISSUE_ID,
        repository_id: null,
        worktree_id: null,
        agent_id: null,
        status: "running",
        branch: "b",
        plan_json: { version: 1, steps: [] },
        started_at: null,
        completed_at: null,
        created_at: "2026-07-05T00:00:00.000Z",
        updated_at: "2026-07-05T00:00:00.000Z",
      };
    },
  });

  const res = await post(app, `/api/runs/${RUN_ID}/review/fix`, { comment_ids: ["c1", "c2"] });
  expect(res.status).toBe(200);
  expect(calls).toEqual(["prepare", "spawn", "mark"]);
  expect(fixPrompt).toBe("built fix prompt");
  expect(marked).toEqual(["c1", "c2"]);
  expect(((await res.json()) as RunContract).status).toBe("running");
});

it("rejects an empty fix selection with 400 and maps conflicts to 409", async () => {
  expect(
    (await post(makeApp(), `/api/runs/${RUN_ID}/review/fix`, { comment_ids: [] })).status,
  ).toBe(400);

  const notFixable = makeApp({
    review: stubReviewService({
      prepareFix: () => {
        throw new CommentsNotFixableError("comment c9 not found on run");
      },
    }),
  });
  const nfRes = await post(notFixable, `/api/runs/${RUN_ID}/review/fix`, { comment_ids: ["c9"] });
  expect(nfRes.status).toBe(409);
  expect(((await nfRes.json()) as { error: string }).error).toBe("comments_not_fixable");

  const notResumable = makeApp({
    review: stubReviewService({
      prepareFix: (_run, commentIds) => ({ prompt: "p", commentIds }),
    }),
    fixRun: async () => {
      throw new RunNotResumableError("busy");
    },
  });
  const nrRes = await post(notResumable, `/api/runs/${RUN_ID}/review/fix`, {
    comment_ids: ["c1"],
  });
  expect(nrRes.status).toBe(409);
  expect(((await nrRes.json()) as { error: string }).error).toBe("run_not_fixable");
});

it("serves and persists the local PR draft", async () => {
  const empty = await request(makeApp(), `/api/runs/${RUN_ID}/pr`);
  expect(((await empty.json()) as PullRequestDetail).pull_request).toBeNull();

  const app = makeApp({
    review: stubReviewService({
      getPullRequest: () => pullRequestRow(),
      preparePullRequest: (_run, request) => ({
        row: pullRequestRow({ title: request.title }),
        created: true,
      }),
    }),
  });

  const created = await post(app, `/api/runs/${RUN_ID}/pr`, { title: "First slice", body: "" });
  expect(created.status).toBe(201);
  expect(((await created.json()) as PullRequestDetail).pull_request?.title).toBe("First slice");

  const fetched = await request(app, `/api/runs/${RUN_ID}/pr`);
  expect(((await fetched.json()) as PullRequestDetail).pull_request?.status).toBe("draft");

  expect((await post(app, `/api/runs/${RUN_ID}/pr`, { title: "" })).status).toBe(400);
});

it("returns 200 when updating an existing PR draft", async () => {
  const app = makeApp({
    review: stubReviewService({
      preparePullRequest: (_run, request) => ({
        row: pullRequestRow({ title: request.title }),
        created: false,
      }),
    }),
  });
  const res = await post(app, `/api/runs/${RUN_ID}/pr`, { title: "Renamed", body: "b" });
  expect(res.status).toBe(200);
});
