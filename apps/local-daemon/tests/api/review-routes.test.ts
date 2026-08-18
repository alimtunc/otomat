import type {
  ReviewCommentContract,
  ReviewDetail,
  RunContract,
  ReviewDiffResponse,
} from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import type { CanonicalDiff } from "#git";
import {
  CommentDestinationUnavailableError,
  CommentPublicationFailedError,
  CommentRangeInvalidError,
  CommentsNotFixableError,
  DiffUnavailableError,
  ReviewAnchorStaleError,
  type FixRequest,
} from "#review";
import { ReviewFixBusyError, RunWorkspaceClosedError } from "#supervisor";

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
      getDiff: () => ({ computedAt: "2026-07-05T00:00:00.000Z", diff: DIFF }),
    }),
  });
  const res = await request(app, `/api/runs/${RUN_ID}/diff`);
  expect(res.status).toBe(200);
  const body = (await res.json()) as ReviewDiffResponse;
  expect(body.subject_id).toBe(RUN_ID);
  expect(body.diff?.sha).toBe("diff-sha");
  expect(body.diff?.files[0]).toMatchObject({ path: "notes.md", old_path: null, sha: "file-sha" });
});

it("serves an honest null diff when the run has no worktree", async () => {
  const res = await request(makeApiApp(t), `/api/runs/${RUN_ID}/diff`);
  expect(res.status).toBe(200);
  expect(((await res.json()) as ReviewDiffResponse).diff).toBeNull();
});

it("serves the review surface with serialized comments and the fix authority", async () => {
  const app = makeApiApp(t, {
    review: stubReviewService({
      getReviewDetail: () => ({
        review: reviewRow(),
        comments: [commentRow()],
        fixAuthority: { kind: "external", reason: "Otomat does not own this branch." },
        destinations: { pr_review: false, reason: "This run has no pull request yet." },
      }),
    }),
  });
  const res = await request(app, `/api/runs/${RUN_ID}/review`);
  const body = (await res.json()) as ReviewDetail;
  expect(body.review?.status).toBe("in_review");
  expect(body.comments[0]).toMatchObject({ id: "c1", diff_sha: "sha-1", status: "open" });
  expect(body.comments[0]).not.toHaveProperty("created_at");
  expect(body.fix_authority).toEqual({
    kind: "external",
    reason: "Otomat does not own this branch.",
  });
});

it("hands back the exact base and head blobs behind one file of the diff", async () => {
  const app = makeApiApp(t, {
    review: stubReviewService({
      getFileBlobs: () => ({ base: "alpha\n", head: "alpha\nbeta\n" }),
    }),
  });
  const res = await request(
    app,
    `/api/runs/${RUN_ID}/diff/file?path=${encodeURIComponent("src/thing.ts")}&sha=sha-1`,
  );
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ base_content: "alpha\n", head_content: "alpha\nbeta\n" });
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
  expect(((await res.json()) as { error: string }).error).toBe("blobs_anchor_stale");
});

it("creates a pinned comment and returns 201", async () => {
  let received: unknown;
  const app = makeApiApp(t, {
    review: stubReviewService({
      addComment: async (_run, req) => {
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
  expect(((await res.json()) as { error: string }).error).toBe("invalid_request");
});

it("explains a refused range and an unreachable destination instead of failing blankly", async () => {
  const ranged = makeApiApp(t, {
    review: stubReviewService({
      addComment: async () => {
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
      addComment: async () => {
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

it("publishes one PR-review comment and reports a GitHub refusal as a bad gateway", async () => {
  let publishedId = "";
  const app = makeApiApp(t, {
    review: stubReviewService({
      publishComment: async (_run, commentId) => {
        publishedId = commentId;
        return commentRow({
          destination: "pr_review",
          publication_status: "published",
          external_url: "https://gh/pr/7#r1",
        });
      },
    }),
  });
  const res = await post(app, `/api/runs/${RUN_ID}/review/comments/c1/publish`, {});
  expect(res.status).toBe(200);
  expect(publishedId).toBe("c1");
  expect((await res.json()) as ReviewCommentContract).toMatchObject({
    publication_status: "published",
    external_url: "https://gh/pr/7#r1",
  });

  const failing = makeApiApp(t, {
    review: stubReviewService({
      publishComment: async () => {
        throw new CommentPublicationFailedError("GitHub refused the review comment. (HTTP 422)");
      },
    }),
  });
  const failed = await post(failing, `/api/runs/${RUN_ID}/review/comments/c1/publish`, {});
  expect(failed.status).toBe(502);
  expect(await failed.json()).toEqual({
    error: "comment_publication_failed",
    message: "GitHub refused the review comment. (HTTP 422)",
  });
});

it("maps stale anchors and missing diffs to 409 conflicts", async () => {
  const stale = makeApiApp(t, {
    review: stubReviewService({
      addComment: async () => {
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
      addComment: async () => {
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

it("delegates the fix request with the parsed selection and returns the updated run", async () => {
  let received: { runId: string; request: FixRequest } | null = null;
  const app = makeApiApp(t, {
    review: stubReviewService({
      requestFix: async (run, fix) => {
        received = { runId: run.id, request: fix };
        return runRow(RUN_ID);
      },
    }),
  });

  const res = await post(app, `/api/runs/${RUN_ID}/review/fix`, {
    comment_ids: ["c1", "c2"],
    profile_id: "p-reviewer",
    note: "keep the public API stable",
    context: [{ kind: "file", path: "src/api.ts" }],
  });
  expect(res.status).toBe(201);
  expect(received).toEqual({
    runId: RUN_ID,
    request: {
      commentIds: ["c1", "c2"],
      note: "keep the public API stable",
      references: [{ kind: "file", path: "src/api.ts" }],
      selector: { kind: "profile", profileId: "p-reviewer" },
      overrides: {},
    },
  });
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

  const conflicts = [
    {
      error: new CommentsNotFixableError("comment c9 not found on run"),
      code: "comments_not_fixable",
    },
    { error: new RunWorkspaceClosedError("merged"), code: "workspace_closed" },
    { error: new ReviewFixBusyError(RUN_ID), code: "workspace_busy" },
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
      comment_ids: ["c1"],
      runtime: "fake",
    });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe(conflict.code);
  }
});
