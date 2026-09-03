import type {
  ReviewCommentContract,
  ReviewDetail,
  ReviewedFileContract,
  AppendedRunStepResponse,
  ReviewDiffResponse,
  SubmitReviewRequest,
} from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import type { CanonicalDiff } from "#git";
import {
  CommentDestinationUnavailableError,
  CommentRangeInvalidError,
  CommentsNotFixableError,
  DiffUnavailableError,
  ReviewAnchorStaleError,
  ReviewSubmissionBusyError,
  ReviewSubmissionEmptyError,
  ReviewSubmissionFailedError,
  ReviewSubmissionUnavailableError,
  type FixRequest,
} from "#review";
import { ReviewFixBusyError, RunWorkspaceClosedError } from "#supervisor";

import { json, makeApiApp, post, request, runRowWithStep } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";
import {
  BRANCH_SCOPE,
  commentRow,
  reviewedFileRow,
  reviewRow,
  stubReviewService,
} from "../support/review.js";
import { seedRun } from "../support/seed.js";

const RUN_ID = "run-review";

let t: TestDb;

const DIFF: CanonicalDiff = {
  base: "base-sha",
  head: "head-sha",
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
      getDiff: () => ({
        computedAt: "2026-07-05T00:00:00.000Z",
        diff: DIFF,
        scope: BRANCH_SCOPE,
        unavailable: null,
      }),
    }),
  });
  const res = await request(app, `/api/runs/${RUN_ID}/diff`);
  expect(res.status).toBe(200);
  const body = await json<ReviewDiffResponse>(res);
  expect(body.subject_id).toBe(RUN_ID);
  expect(body.diff?.sha).toBe("diff-sha");
  expect(body.diff?.files[0]).toMatchObject({ path: "notes.md", old_path: null, sha: "file-sha" });
});

it("serves an honest null diff when the run has no worktree", async () => {
  const res = await request(makeApiApp(t), `/api/runs/${RUN_ID}/diff`);
  expect(res.status).toBe(200);
  expect((await json<ReviewDiffResponse>(res)).diff).toBeNull();
});

it("serves the review surface with serialized comments and the fix authority", async () => {
  const app = makeApiApp(t, {
    review: stubReviewService({
      getReviewDetail: () => ({
        review: reviewRow(),
        comments: [commentRow()],
        reviewedFiles: [],
        fixAuthority: { kind: "external", reason: "Otomat does not own this branch." },
        destinations: { pr_review: false, reason: "This run has no pull request yet." },
        submission: { events: [], reason: "This run has no pull request yet." },
      }),
    }),
  });
  const res = await request(app, `/api/runs/${RUN_ID}/review`);
  const body = await json<ReviewDetail>(res);
  expect(body.review?.status).toBe("in_review");
  expect(body.comments[0]).toMatchObject({ id: "c1", diff_sha: "sha-1", status: "open" });
  expect(body.comments[0]).not.toHaveProperty("created_at");
  expect(body.fix_authority).toEqual({
    kind: "external",
    reason: "Otomat does not own this branch.",
  });
});

it("serves the reviewed marks alongside the comments", async () => {
  const app = makeApiApp(t, {
    review: stubReviewService({
      getReviewDetail: () => ({
        review: reviewRow(),
        comments: [],
        reviewedFiles: [reviewedFileRow({ sync_status: "failed", sync_error: "GitHub said no." })],
        fixAuthority: { kind: "otomat", reason: "Otomat owns this branch." },
        destinations: { pr_review: false, reason: "This run has no pull request yet." },
        submission: { events: [], reason: "This run has no pull request yet." },
      }),
    }),
  });
  const body = await json<ReviewDetail>(await request(app, `/api/runs/${RUN_ID}/review`));
  expect(body.reviewed_files[0]).toMatchObject({
    file_path: "src/thing.ts",
    diff_sha: "sha-1",
    reviewed: true,
    sync_status: "failed",
    sync_error: "GitHub said no.",
  });
  expect(body.reviewed_files[0]).not.toHaveProperty("viewer_login");
});

it("answers a refused synchronization with the persisted mark, not with a failure", async () => {
  let received: unknown;
  const app = makeApiApp(t, {
    review: stubReviewService({
      setReviewedFile: async (_subject, mark) => {
        received = mark;
        return reviewedFileRow({
          file_path: mark.file_path,
          diff_sha: mark.diff_sha,
          reviewed: mark.reviewed,
          sync_status: "failed",
          sync_error: "GitHub is unreachable.",
        });
      },
    }),
  });
  const res = await post(app, `/api/runs/${RUN_ID}/review/files`, {
    file_path: "notes.md",
    diff_sha: "file-sha",
    reviewed: true,
  });
  expect(res.status).toBe(200);
  expect(received).toEqual({ file_path: "notes.md", diff_sha: "file-sha", reviewed: true });
  expect(await json<ReviewedFileContract>(res)).toMatchObject({
    reviewed: true,
    sync_status: "failed",
    sync_error: "GitHub is unreachable.",
  });
});

it("hands back the exact base and head blobs behind one file of the diff", async () => {
  const app = makeApiApp(t, {
    review: stubReviewService({
      getFileBlobs: () => ({
        base: { kind: "text", content: "alpha\n" },
        head: { kind: "text", content: "alpha\nbeta\n" },
      }),
    }),
  });
  const res = await request(
    app,
    `/api/runs/${RUN_ID}/diff/file?path=${encodeURIComponent("src/thing.ts")}&sha=sha-1`,
  );
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({
    base: { kind: "text", content: "alpha\n" },
    head: { kind: "text", content: "alpha\nbeta\n" },
  });
});

it("encodes media bytes without decoding them as text", async () => {
  const app = makeApiApp(t, {
    review: stubReviewService({
      getFileBlobs: () => ({
        base: null,
        head: { kind: "media", data: Buffer.from([0, 1, 2, 255]), mediaType: "image/png" },
      }),
    }),
  });
  const res = await request(
    app,
    `/api/runs/${RUN_ID}/diff/file?path=${encodeURIComponent("image.png")}&sha=sha-1`,
  );

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({
    base: null,
    head: { kind: "media", data: "AAEC/w==", media_type: "image/png" },
  });
});

it("refuses blobs read against a moved anchor instead of expanding the wrong context", async () => {
  const app = makeApiApp(t, {
    review: stubReviewService({
      getFileBlobs: () => {
        throw new ReviewAnchorStaleError("src/thing.ts");
      },
    }),
  });
  const res = await request(app, `/api/runs/${RUN_ID}/diff/file?path=src/thing.ts&sha=old`);
  expect(res.status).toBe(409);
  expect((await json<{ error: string }>(res)).error).toBe("blobs_anchor_stale");
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
  expect((await json<ReviewCommentContract>(res)).id).toBe("c1");
  // Absent side and destination are defaulted by the contract, never left undefined.
  expect(received).toEqual({
    file_path: "src/thing.ts",
    side: "new",
    line: 12,
    diff_sha: "sha-1",
    body: "Rename this.",
    destination: "agent",
  });
});

it("rejects an invalid comment body with 400", async () => {
  const res = await post(makeApiApp(t), `/api/runs/${RUN_ID}/review/comments`, { body: "" });
  expect(res.status).toBe(400);
  expect((await json<{ error: string }>(res)).error).toBe("invalid_request");
});

it("explains a refused range and an unreachable destination instead of failing blankly", async () => {
  const ranged = makeApiApp(t, {
    review: stubReviewService({
      addComment: () => {
        throw new CommentRangeInvalidError("Lines 4–11 of this file are not.");
      },
    }),
  });
  const rangeRes = await post(ranged, `/api/runs/${RUN_ID}/review/comments`, {
    file_path: "src/thing.ts",
    start_line: 4,
    line: 11,
    diff_sha: "sha-1",
    body: "x",
  });
  expect(rangeRes.status).toBe(422);
  expect(await rangeRes.json()).toEqual({
    error: "comment_range_invalid",
    message: "Lines 4–11 of this file are not.",
  });

  const unreachable = makeApiApp(t, {
    review: stubReviewService({
      addComment: () => {
        throw new CommentDestinationUnavailableError("This run has no pull request yet.");
      },
    }),
  });
  const destRes = await post(unreachable, `/api/runs/${RUN_ID}/review/comments`, {
    file_path: "src/thing.ts",
    line: 11,
    diff_sha: "sha-1",
    destination: "pr_review",
    body: "x",
  });
  expect(destRes.status).toBe(409);
  expect(await destRes.json()).toEqual({
    error: "comment_destination_unavailable",
    message: "This run has no pull request yet.",
  });
});

it("submits a review and reports a GitHub refusal as a bad gateway", async () => {
  let submitted: SubmitReviewRequest | null = null;
  const app = makeApiApp(t, {
    review: stubReviewService({
      submitReview: async (_ref, body) => {
        submitted = body;
        return {
          review: null,
          comments: [
            commentRow({
              destination: "pr_review",
              publication_status: "published",
              external_url: "https://gh/pr/7#r1",
            }),
          ],
          reviewedFiles: [],
          fixAuthority: { kind: "otomat", reason: "Otomat owns this branch." },
          destinations: { pr_review: true, reason: "Pull request #7 is open for review." },
          submission: { events: ["comment"], reason: "Pull request #7 is open for review." },
        };
      },
    }),
  });
  const res = await post(app, `/api/runs/${RUN_ID}/review/submit`, {
    body: "Two notes",
    event: "comment",
  });
  expect(res.status).toBe(200);
  expect(submitted).toEqual({ body: "Two notes", event: "comment" });
  expect((await json<ReviewDetail>(res)).comments[0]).toMatchObject({
    publication_status: "published",
    external_url: "https://gh/pr/7#r1",
  });

  const failing = makeApiApp(t, {
    review: stubReviewService({
      submitReview: async () => {
        throw new ReviewSubmissionFailedError("GitHub refused the review. (HTTP 422)");
      },
    }),
  });
  const failed = await post(failing, `/api/runs/${RUN_ID}/review/submit`, {
    body: "Two notes",
    event: "comment",
  });
  expect(failed.status).toBe(502);
  expect(await failed.json()).toEqual({
    error: "review_submission_failed",
    message: "GitHub refused the review. (HTTP 422)",
  });
});

it("names the refusal when a review may not be submitted at all", async () => {
  const refusals = [
    {
      error: new ReviewSubmissionUnavailableError(
        "GitHub does not let @octocat approve a pull request they opened.",
      ),
      status: 409,
      body: {
        error: "review_submission_unavailable",
        message: "GitHub does not let @octocat approve a pull request they opened.",
      },
    },
    {
      error: new ReviewSubmissionBusyError("This review is already being submitted."),
      status: 409,
      body: {
        error: "review_submission_busy",
        message: "This review is already being submitted.",
      },
    },
    {
      error: new ReviewSubmissionEmptyError("Write a summary or leave a comment on the diff."),
      status: 422,
      body: {
        error: "review_submission_empty",
        message: "Write a summary or leave a comment on the diff.",
      },
    },
  ];

  for (const refusal of refusals) {
    const app = makeApiApp(t, {
      review: stubReviewService({
        submitReview: async () => {
          throw refusal.error;
        },
      }),
    });
    const res = await post(app, `/api/runs/${RUN_ID}/review/submit`, {
      body: "Two notes",
      event: "approve",
    });
    expect(res.status).toBe(refusal.status);
    expect(await res.json()).toEqual(refusal.body);
  }
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
  expect((await json<{ error: string }>(staleRes)).error).toBe("comment_anchor_stale");

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
  expect((await json<{ error: string }>(bareRes)).error).toBe("diff_unavailable");
});

it("delegates the fix request with its parsed agent and returns the updated run", async () => {
  let received: { runId: string; request: FixRequest } | null = null;
  const app = makeApiApp(t, {
    review: stubReviewService({
      requestFix: async (run, fix) => {
        received = { runId: run.id, request: fix };
        return runRowWithStep(RUN_ID, "fix-review-comments");
      },
    }),
  });

  const res = await post(app, `/api/runs/${RUN_ID}/review/fix`, {
    profile_id: "p-reviewer",
    note: "keep the public API stable",
    context: [{ kind: "file", path: "src/api.ts" }],
  });
  expect(res.status).toBe(201);
  expect(received).toEqual({
    runId: RUN_ID,
    request: {
      note: "keep the public API stable",
      references: [{ kind: "file", path: "src/api.ts" }],
      selector: { kind: "profile", profileId: "p-reviewer" },
      overrides: {},
    },
  });
  expect(await json<AppendedRunStepResponse>(res)).toMatchObject({
    run: { status: "running" },
    step_run_id: "fix-review-comments",
  });
});

it("refuses a fix with no explicit agent, and maps conflicts to 409", async () => {
  const noAgent = await post(makeApiApp(t), `/api/runs/${RUN_ID}/review/fix`, {});
  expect(noAgent.status).toBe(400);

  const chosenComments = await post(makeApiApp(t), `/api/runs/${RUN_ID}/review/fix`, {
    comment_ids: ["c1"],
    profile_id: "p-reviewer",
  });
  expect(chosenComments.status).toBe(400);

  const notFixable = new CommentsNotFixableError("No open agent comment is waiting for a fix.");
  const conflicts = [
    { error: notFixable, code: "comments_not_fixable", message: notFixable.message },
    { error: new RunWorkspaceClosedError("merged"), code: "workspace_closed", message: null },
    { error: new ReviewFixBusyError(RUN_ID), code: "workspace_busy", message: null },
  ];
  for (const conflict of conflicts) {
    const app = makeApiApp(t, {
      review: stubReviewService({
        requestFix: async () => {
          throw conflict.error;
        },
      }),
    });
    const res = await post(app, `/api/runs/${RUN_ID}/review/fix`, {
      profile_id: "p-reviewer",
    });
    expect(res.status).toBe(409);
    const body = await json<{ error: string; message?: string }>(res);
    expect(body.error).toBe(conflict.code);
    if (conflict.message !== null) expect(body.message).toBe(conflict.message);
  }
});
