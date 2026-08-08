import type {
  ReviewCommentContract,
  ReviewDetail,
  RunContract,
  RunDiffResponse,
} from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import type { CanonicalDiff } from "#git";
import { CommentsNotFixableError, DiffUnavailableError, ReviewAnchorStaleError } from "#review";
import { RunWorkspaceClosedError, type AppendStepInput } from "#supervisor";

import { makeApiApp, post, request, runRow } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";
import { commentRow, reviewRow, stubReviewService } from "../support/review.js";
import { seedRun } from "../support/seed.js";

const RUN_ID = "run-review";

let t: TestDb;

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
  t = setupTestDb("otomat-review-api-");
  seedRun(t.db, {
    runId: RUN_ID,
    runStatus: "review_ready",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
    providerSessionId: "ps-1",
  });
});

afterEach(() => {
  t.cleanup();
});

it("returns 404 on every review surface for an unknown run", async () => {
  const app = makeApiApp(t);
  for (const path of ["/diff", "/review", "/pr"]) {
    expect((await request(app, `/api/runs/nope${path}`)).status).toBe(404);
  }
});

it("serves the canonical diff mapped to the wire contract", async () => {
  const app = makeApiApp(t, {
    review: stubReviewService({
      getWorktreeDiff: () => ({ computedAt: "2026-07-05T00:00:00.000Z", diff: DIFF }),
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
  const res = await request(makeApiApp(t), `/api/runs/${RUN_ID}/diff`);
  expect(res.status).toBe(200);
  expect(((await res.json()) as RunDiffResponse).diff).toBeNull();
});

it("serves the review surface with serialized comments", async () => {
  const app = makeApiApp(t, {
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
  const app = makeApiApp(t, {
    review: stubReviewService({
      addComment: (_run, req) => {
        received = req;
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
  const res = await post(makeApiApp(t), `/api/runs/${RUN_ID}/review/comments`, { body: "" });
  expect(res.status).toBe(400);
  expect(((await res.json()) as { error: string }).error).toBe("invalid_request");
});

it("maps stale anchors and missing diffs to 409 conflicts", async () => {
  const stale = makeApiApp(t, {
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

  const bare = makeApiApp(t, {
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

it("orchestrates a fix request: prepare, append the step, then mark", async () => {
  const calls: string[] = [];
  let appended: AppendStepInput | null = null;
  let marked: string[] = [];
  const app = makeApiApp(t, {
    review: stubReviewService({
      prepareFix: (_run, commentIds) => {
        calls.push("prepare");
        return { prompt: "built fix prompt", commentIds, dependsOn: ["step-1"] };
      },
      markFixRequested: (_runId, commentIds) => {
        calls.push("mark");
        marked = commentIds;
      },
    }),
    appendRunStep: async (_runId, input) => {
      calls.push("append");
      appended = input;
      return runRow(RUN_ID);
    },
  });

  const res = await post(app, `/api/runs/${RUN_ID}/review/fix`, {
    comment_ids: ["c1", "c2"],
    profile_id: "p-reviewer",
  });
  expect(res.status).toBe(201);
  expect(calls).toEqual(["prepare", "append", "mark"]);
  expect(appended).toMatchObject({
    name: "Fix review comments",
    prompt: "built fix prompt",
    selector: { kind: "profile", profileId: "p-reviewer" },
    dependsOn: ["step-1"],
    origin: "review_fix",
  });
  expect(marked).toEqual(["c1", "c2"]);
  expect(((await res.json()) as RunContract).status).toBe("running");
});

it("refuses a fix with no explicit agent, and maps conflicts to 409", async () => {
  const noAgent = await post(makeApiApp(t), `/api/runs/${RUN_ID}/review/fix`, {
    comment_ids: ["c1"],
  });
  expect(noAgent.status).toBe(400);

  const emptySelection = await post(makeApiApp(t), `/api/runs/${RUN_ID}/review/fix`, {
    comment_ids: [],
    runtime: "fake",
  });
  expect(emptySelection.status).toBe(400);

  const notFixable = makeApiApp(t, {
    review: stubReviewService({
      prepareFix: () => {
        throw new CommentsNotFixableError("comment c9 not found on run");
      },
    }),
  });
  const nfRes = await post(notFixable, `/api/runs/${RUN_ID}/review/fix`, {
    comment_ids: ["c9"],
    runtime: "fake",
  });
  expect(nfRes.status).toBe(409);
  expect(((await nfRes.json()) as { error: string }).error).toBe("comments_not_fixable");

  const closed = makeApiApp(t, {
    review: stubReviewService({
      prepareFix: (_run, commentIds) => ({ prompt: "p", commentIds, dependsOn: [] }),
    }),
    appendRunStep: async () => {
      throw new RunWorkspaceClosedError("merged");
    },
  });
  const closedRes = await post(closed, `/api/runs/${RUN_ID}/review/fix`, {
    comment_ids: ["c1"],
    runtime: "fake",
  });
  expect(closedRes.status).toBe(409);
  expect(((await closedRes.json()) as { error: string }).error).toBe("workspace_closed");
});
