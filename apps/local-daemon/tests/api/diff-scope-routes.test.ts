import type {
  CommentFixProof,
  ReviewDiffResponse,
  RunCommitsResponse,
  RunDiffScopeSelector,
} from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { DiffScopeNotFoundError } from "#review";

import { json, makeApiApp, request } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";
import { stubReviewService } from "../support/review.js";
import { seedRun } from "../support/seed.js";

const RUN_ID = "run-scope";

let t: TestDb;
let asked: RunDiffScopeSelector[] = [];

function appEchoingScope() {
  return makeApiApp(t, {
    review: stubReviewService({
      getDiff: (_ref, scope = { kind: "workspace" }) => {
        asked.push(scope);
        return {
          computedAt: "2026-08-16T00:00:00.000Z",
          diff: null,
          scope: { kind: "workspace" },
          unavailable: "nothing here",
        };
      },
    }),
  });
}

beforeEach(() => {
  t = setupTestDb("otomat-diff-scope-api-");
  asked = [];
  seedRun(t.db, {
    runId: RUN_ID,
    runStatus: "review_ready",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
  });
});

afterEach(() => {
  t.cleanup();
});

it("reads the workspace scope when the query names none", async () => {
  const res = await request(appEchoingScope(), `/api/runs/${RUN_ID}/diff`);

  expect(res.status).toBe(200);
  expect(asked).toEqual([{ kind: "workspace" }]);
});

it("passes a commit and a session scope through verbatim", async () => {
  const app = appEchoingScope();
  await request(app, `/api/runs/${RUN_ID}/diff?scope=commit&commit=abc123`);
  await request(app, `/api/runs/${RUN_ID}/diff?scope=session&session=sess-9`);

  expect(asked).toEqual([
    { kind: "commit", commit: "abc123" },
    { kind: "session", session: "sess-9" },
  ]);
});

it("refuses a scope naming nothing rather than answering with the workspace", async () => {
  const app = appEchoingScope();

  expect((await request(app, `/api/runs/${RUN_ID}/diff?scope=commit`)).status).toBe(400);
  expect((await request(app, `/api/runs/${RUN_ID}/diff?scope=session`)).status).toBe(400);
  expect((await request(app, `/api/runs/${RUN_ID}/diff?scope=nonsense`)).status).toBe(400);
  expect(asked).toEqual([]);
});

it("hands back the daemon's own unavailable sentence with a null diff", async () => {
  const res = await request(appEchoingScope(), `/api/runs/${RUN_ID}/diff?scope=session&session=s1`);
  const body = await json<ReviewDiffResponse>(res);

  expect(body.diff).toBeNull();
  expect(body.unavailable).toBe("nothing here");
  expect(body.scope).toEqual({ kind: "workspace" });
});

it("answers 404 for a scope the run does not have", async () => {
  const app = makeApiApp(t, {
    review: stubReviewService({
      getDiff: () => {
        throw new DiffScopeNotFoundError("commit_not_found", "commit deadbeef is not here");
      },
    }),
  });

  const res = await request(app, `/api/runs/${RUN_ID}/diff?scope=commit&commit=deadbeef`);

  expect(res.status).toBe(404);
  expect(await res.json()).toMatchObject({ error: "commit_not_found" });
});

it("serves the branch commits a picker reads", async () => {
  const app = makeApiApp(t, {
    review: stubReviewService({
      getBranchCommits: () => ({
        commits: [
          {
            sha: "a".repeat(40),
            short_sha: "aaaaaaa",
            subject: "first",
            author_name: "Picker",
            authored_at: "2026-08-16T22:25:12+03:00",
          },
        ],
        unavailable: null,
      }),
    }),
  });

  const res = await request(app, `/api/runs/${RUN_ID}/commits`);
  const body = await json<RunCommitsResponse>(res);

  expect(res.status).toBe(200);
  expect(body.commits[0]).toMatchObject({
    short_sha: "aaaaaaa",
    subject: "first",
    // git formats `%aI` with a numeric offset; the contract must accept it.
    authored_at: "2026-08-16T22:25:12+03:00",
  });
});

it("serves a comment's fix proof as the daemon computed it", async () => {
  const proof: CommentFixProof = {
    state: "no_change",
    pass: { agent_session_id: "sess-1", step_name: "Fix review comments" },
    reason: "This pass changed notes.md, but not the lines this comment anchors to.",
  };
  const app = makeApiApp(t, {
    review: stubReviewService({ getCommentFixProof: () => proof }),
  });

  const res = await request(app, `/api/runs/${RUN_ID}/review/comments/c1/fix-proof`);

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual(proof);
});
