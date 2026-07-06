import { appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  getPullRequestForRun,
  getReviewComment,
  getReviewForRun,
  getRun,
  listReviewCommentsForRun,
} from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { readRunEvents } from "#events";
import { createGitWorktreeService, type GitWorktreeService } from "#git";
import {
  createReviewService,
  DiffUnavailableError,
  ReviewAnchorStaleError,
  CommentsNotFixableError,
  type ReviewService,
} from "#review";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { seedRepository } from "../support/db.js";
import { setupTestRepo, type TestRepo } from "../support/git.js";
import { seedRun } from "../support/seed.js";

const RUN_ID = "r-review";
const BRANCH = "otomat/run/r-review";

let fix: DaemonTestDb;
let repo: TestRepo;
let worktrees: GitWorktreeService;
let review: ReviewService;
let worktreePath = "";

beforeEach(() => {
  fix = setupDaemonDb();
  repo = setupTestRepo();
  seedRepository(fix.db, repo.defaultBranch);
  worktrees = createGitWorktreeService({
    db: fix.db,
    repositoryId: "repo-1",
    repoRoot: repo.root,
    defaultBranch: repo.defaultBranch,
    worktreesRoot: join(fix.dataDir, "worktrees"),
  });
  review = createReviewService({ db: fix.db, dataDir: fix.dataDir, worktrees });

  seedRun(fix.db, {
    runId: RUN_ID,
    runStatus: "review_ready",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
    providerSessionId: "ps-review",
  });
  worktreePath = worktrees.acquire({ owner: RUN_ID, branch: BRANCH }).path;
  writeFileSync(join(worktreePath, "notes.md"), "alpha\nbeta\ngamma\n");
});

afterEach(() => {
  repo.cleanup();
  fix.cleanup();
});

function run() {
  const row = getRun(fix.db, RUN_ID);
  if (!row) throw new Error("seeded run missing");
  return row;
}

function currentAnchor() {
  const diff = review.getRunDiff(run()).diff;
  const file = diff?.files.find((f) => f.path === "notes.md");
  if (!file) throw new Error("expected notes.md in the diff");
  return file;
}

it("computes the real git diff for the run's worktree and null without one", () => {
  const withWorktree = review.getRunDiff(run());
  expect(withWorktree.diff?.files.map((f) => f.path)).toEqual(["notes.md"]);
  expect(withWorktree.diff?.additions).toBe(3);

  seedRun(fix.db, {
    runId: "r-bare",
    runStatus: "review_ready",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
  });
  const bare = getRun(fix.db, "r-bare");
  expect(bare && review.getRunDiff(bare).diff).toBeNull();
});

it("pins a comment to the live diff, snapshots its hunk, and opens the review", () => {
  const anchor = currentAnchor();
  const comment = review.addComment(run(), {
    file_path: "notes.md",
    line: 2,
    diff_sha: anchor.sha,
    body: "beta should be delta",
  });

  expect(comment.status).toBe("open");
  expect(comment.diff_sha).toBe(anchor.sha);
  expect(comment.hunk_snapshot).toContain("+beta");

  expect(getReviewForRun(fix.db, RUN_ID)?.status).toBe("in_review");

  const events = readRunEvents(fix.db, RUN_ID);
  const created = events.find((e) => e.type === "review.comment_created");
  expect(created?.payload["comment_id"]).toBe(comment.id);
});

it("rejects a stale anchor and a run without a diff — no silent re-anchoring", () => {
  expect(() =>
    review.addComment(run(), {
      file_path: "notes.md",
      line: 1,
      diff_sha: "not-the-current-sha",
      body: "stale",
    }),
  ).toThrow(ReviewAnchorStaleError);

  seedRun(fix.db, {
    runId: "r-bare2",
    runStatus: "review_ready",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
  });
  const bare = getRun(fix.db, "r-bare2");
  expect(
    () => bare && review.addComment(bare, { file_path: "x", line: 0, diff_sha: "s", body: "b" }),
  ).toThrow(DiffUnavailableError);
});

it("builds the fix context from comment + original hunk + current file", () => {
  const anchor = currentAnchor();
  const comment = review.addComment(run(), {
    file_path: "notes.md",
    line: 2,
    diff_sha: anchor.sha,
    body: "beta should be delta",
  });

  const preparation = review.prepareFix(run(), [comment.id]);
  expect(preparation.prompt).toContain("beta should be delta");
  expect(preparation.prompt).toContain("+beta");
  expect(preparation.prompt).toContain("alpha\nbeta\ngamma");
  expect(preparation.prompt).toContain(BRANCH);

  expect(() => review.prepareFix(run(), ["nope"])).toThrow(CommentsNotFixableError);
});

it("stamps fix-requested comments and drives the review to changes_requested", () => {
  const anchor = currentAnchor();
  const comment = review.addComment(run(), {
    file_path: "notes.md",
    line: 2,
    diff_sha: anchor.sha,
    body: "fix me",
  });

  review.markFixRequested(RUN_ID, [comment.id]);
  expect(getReviewComment(fix.db, comment.id)?.fix_requested_at).not.toBeNull();
  expect(getReviewForRun(fix.db, RUN_ID)?.status).toBe("changes_requested");
});

it("on a completed settle: emits git.diff_updated, marks fixed comments addressed and moved anchors outdated", () => {
  const anchor = currentAnchor();
  const requested = review.addComment(run(), {
    file_path: "notes.md",
    line: 2,
    diff_sha: anchor.sha,
    body: "fix me",
  });
  const bystander = review.addComment(run(), {
    file_path: "notes.md",
    line: 3,
    diff_sha: anchor.sha,
    body: "just a note",
  });
  review.markFixRequested(RUN_ID, [requested.id]);

  // The "fix turn" really edits the worktree, so both anchors leave the live diff.
  appendFileSync(join(worktreePath, "notes.md"), "delta\n");

  review.onRunSettled({ runId: RUN_ID, classification: "completed" });

  expect(getReviewComment(fix.db, requested.id)?.status).toBe("addressed");
  expect(getReviewComment(fix.db, bystander.id)?.status).toBe("outdated");
  expect(getReviewForRun(fix.db, RUN_ID)?.status).toBe("resolved");

  const events = readRunEvents(fix.db, RUN_ID);
  expect(events.some((e) => e.type === "git.diff_updated")).toBe(true);
  const resolutions = events
    .filter((e) => e.type === "review.comment_resolved")
    .map((e) => e.payload["resolution"]);
  expect(resolutions.toSorted()).toEqual(["addressed", "outdated"]);

  // Snapshots keep showing what the reviewer saw at comment time.
  expect(getReviewComment(fix.db, requested.id)?.hunk_snapshot).toContain("+beta");
});

it("keeps untouched anchors open across a completed settle", () => {
  const anchor = currentAnchor();
  const comment = review.addComment(run(), {
    file_path: "notes.md",
    line: 1,
    diff_sha: anchor.sha,
    body: "still valid",
  });

  review.onRunSettled({ runId: RUN_ID, classification: "completed" });
  expect(getReviewComment(fix.db, comment.id)?.status).toBe("open");
  expect(getReviewForRun(fix.db, RUN_ID)?.status).toBe("in_review");
});

it("releases pending fix requests when the turn does not complete", () => {
  const anchor = currentAnchor();
  const comment = review.addComment(run(), {
    file_path: "notes.md",
    line: 2,
    diff_sha: anchor.sha,
    body: "fix me",
  });
  review.markFixRequested(RUN_ID, [comment.id]);

  review.onRunSettled({ runId: RUN_ID, classification: "interrupted" });

  const row = getReviewComment(fix.db, comment.id);
  expect(row?.status).toBe("open");
  expect(row?.fix_requested_at).toBeNull();
});

it("persists the local PR draft as a stub — created once, then updated in place", () => {
  const first = review.preparePullRequest(run(), { title: "Slice one", body: "The loop." });
  expect(first.created).toBe(true);
  expect(first.row).toMatchObject({
    status: "draft",
    provider: "github",
    title: "Slice one",
    body: "The loop.",
    number: null,
    url: null,
  });

  const second = review.preparePullRequest(run(), { title: "Slice one, renamed", body: "" });
  expect(second.created).toBe(false);
  expect(second.row.title).toBe("Slice one, renamed");
  expect(second.row.body).toBeNull();
  expect(getPullRequestForRun(fix.db, RUN_ID)?.id).toBe(first.row.id);

  const types = readRunEvents(fix.db, RUN_ID).map((e) => e.type);
  expect(types).toContain("pr.created");
  expect(types).toContain("pr.updated");

  expect(listReviewCommentsForRun(fix.db, RUN_ID)).toEqual([]);
});
