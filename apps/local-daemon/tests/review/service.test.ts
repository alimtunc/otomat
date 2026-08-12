import { appendFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { getReviewComment, getReviewForRun, getRun } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { readRunEvents } from "#events";
import { createRepositoryResolver, type GitWorktreeService } from "#git";
import {
  createReviewService,
  DiffUnavailableError,
  FileNotInDiffError,
  ReviewAnchorStaleError,
  CommentsNotFixableError,
  type ReviewService,
  type ReviewServiceConfig,
} from "#review";
import type { AppendStepInput } from "#supervisor";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { seedRun } from "../support/seed.js";

const RUN_ID = "r-review";
const BRANCH = "otomat/run/r-review";
const FIX_AGENT = { kind: "runtime", runtimeId: "fake" } as const;

let fix: DaemonTestDb;
let worktrees: GitWorktreeService;
let review: ReviewService;
let reviewConfig: ReviewServiceConfig;
let appended: AppendStepInput[] = [];
let worktreePath = "";

beforeEach(() => {
  fix = setupDaemonDb();
  const repositories = createRepositoryResolver({
    db: fix.db,
    worktreesRoot: join(fix.dataDir, "worktrees"),
  });
  const binding = repositories.forRepository("repo-1");
  if (!binding) throw new Error("repo-1 binding missing");
  worktrees = binding.service;
  appended = [];
  reviewConfig = {
    db: fix.db,
    dataDir: fix.dataDir,
    repositories,
    appendRunStep: async (runId, input) => {
      appended.push(input);
      const row = getRun(fix.db, runId);
      if (!row) throw new Error(`run ${runId} missing`);
      return row;
    },
  };
  review = createReviewService(reviewConfig);

  const acquired = worktrees.acquire({ owner: RUN_ID, branch: BRANCH });
  worktreePath = acquired.path;
  seedRun(fix.db, {
    runId: RUN_ID,
    repositoryId: "repo-1",
    worktreeId: acquired.id,
    runStatus: "review_ready",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
    providerSessionId: "ps-review",
  });
  writeFileSync(join(worktreePath, "notes.md"), "alpha\nbeta\ngamma\n");
});

afterEach(() => {
  fix.cleanup();
});

function run() {
  const row = getRun(fix.db, RUN_ID);
  if (!row) throw new Error("seeded run missing");
  return row;
}

function currentAnchor() {
  const diff = review.getWorktreeDiff(run()).diff;
  const file = diff?.files.find((f) => f.path === "notes.md");
  if (!file) throw new Error("expected notes.md in the diff");
  return file;
}

it("computes the real git diff for the run's worktree and null without one", () => {
  const withWorktree = review.getWorktreeDiff(run());
  expect(withWorktree.diff?.files.map((f) => f.path)).toEqual(["notes.md"]);
  expect(withWorktree.diff?.additions).toBe(3);

  seedRun(fix.db, {
    runId: "r-bare",
    repositoryId: null,
    runStatus: "review_ready",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
  });
  const bare = getRun(fix.db, "r-bare");
  expect(bare && review.getWorktreeDiff(bare).diff).toBeNull();
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
    repositoryId: null,
    runStatus: "review_ready",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
  });
  const bare = getRun(fix.db, "r-bare2");
  expect(
    () => bare && review.addComment(bare, { file_path: "x", line: 0, diff_sha: "s", body: "b" }),
  ).toThrow(DiffUnavailableError);
});

it("pins a whole-file comment without capturing a hunk snapshot", () => {
  const anchor = currentAnchor();
  const comment = review.addComment(run(), {
    file_path: "notes.md",
    line: null,
    diff_sha: anchor.sha,
    body: "This file needs a header.",
  });

  expect(comment.line).toBeNull();
  expect(comment.hunk_snapshot).toBe("");
  expect(review.getReviewDetail(RUN_ID).comments.map((c) => c.id)).toEqual([comment.id]);
});

it("serves the exact base and head blobs of a live diff file", () => {
  const blobs = review.getFileBlobs(run(), { path: "notes.md", sha: currentAnchor().sha });

  expect(blobs.base).toBeNull();
  expect(blobs.head).toBe("alpha\nbeta\ngamma\n");
});

it("refuses blobs read against a moved anchor", () => {
  expect(() => review.getFileBlobs(run(), { path: "notes.md", sha: "moved" })).toThrow(
    ReviewAnchorStaleError,
  );
});

it("refuses a path that is not part of the current diff", () => {
  expect(() => review.getFileBlobs(run(), { path: "absent.md", sha: currentAnchor().sha })).toThrow(
    FileNotInDiffError,
  );
});

it("reads a modified file's base side from the fork point, not from the worktree", () => {
  writeFileSync(join(worktreePath, "README.md"), "# base\nplus a line\n");
  const file = review.getWorktreeDiff(run()).diff?.files.find((f) => f.path === "README.md");
  if (!file) throw new Error("expected README.md in the diff");

  const blobs = review.getFileBlobs(run(), { path: "README.md", sha: file.sha });

  expect(blobs.base).toBe("# base\n");
  expect(blobs.head).toBe("# base\nplus a line\n");
});

it("grants fix authority only while Otomat still holds the run's worktree", () => {
  expect(review.getReviewDetail(RUN_ID).fixAuthority.kind).toBe("otomat");

  worktrees.cleanup(RUN_ID);

  const authority = review.getReviewDetail(RUN_ID).fixAuthority;
  expect(authority.kind).toBe("external");
  expect(authority.reason).toContain(BRANCH);
});

it("appends one fix step carrying comment + original hunk + current file", async () => {
  const anchor = currentAnchor();
  const comment = review.addComment(run(), {
    file_path: "notes.md",
    line: 2,
    diff_sha: anchor.sha,
    body: "beta should be delta",
  });

  await review.requestFix(run(), { commentIds: [comment.id], selector: FIX_AGENT });

  const step = appended[0];
  if (!step) throw new Error("expected an appended fix step");
  expect(step.name).toBe("Fix review comments");
  expect(step.origin).toBe("review_fix");
  expect(step.selector).toEqual(FIX_AGENT);
  expect(step.prompt).toContain("beta should be delta");
  expect(step.prompt).toContain("+beta");
  expect(step.prompt).toContain("alpha\nbeta\ngamma");
  expect(step.prompt).toContain(BRANCH);
  // The diff the comment was made against is frozen with it, named by its sha.
  expect(step.prompt).toContain(anchor.sha);
  // The fix waits on the succeeded step that produced that diff.
  expect(step.dependsOn).toEqual([`${RUN_ID}-step`]);

  await expect(
    review.requestFix(run(), { commentIds: ["nope"], selector: FIX_AGENT }),
  ).rejects.toThrow(CommentsNotFixableError);
});

it("keeps a symlinked path's fix context to the link target text, never the host file", async () => {
  const secretPath = join(fix.dataDir, "secret.txt");
  writeFileSync(secretPath, "TOP-SECRET\n");
  symlinkSync(secretPath, join(worktreePath, "leak"));

  const anchor = review.getWorktreeDiff(run()).diff?.files.find((f) => f.path === "leak");
  if (!anchor) throw new Error("expected leak in the diff");
  const comment = review.addComment(run(), {
    file_path: "leak",
    line: null,
    diff_sha: anchor.sha,
    body: "What does this point at?",
  });

  await review.requestFix(run(), { commentIds: [comment.id], selector: FIX_AGENT });
  const step = appended[0];
  expect(step?.prompt).not.toContain("TOP-SECRET");
  expect(step?.prompt).toContain(secretPath);
});

it("stamps fix-requested comments and drives the review to changes_requested", async () => {
  const anchor = currentAnchor();
  const comment = review.addComment(run(), {
    file_path: "notes.md",
    line: 2,
    diff_sha: anchor.sha,
    body: "fix me",
  });

  await review.requestFix(run(), { commentIds: [comment.id], selector: FIX_AGENT });
  expect(getReviewComment(fix.db, comment.id)?.fix_requested_at).not.toBeNull();
  expect(getReviewForRun(fix.db, RUN_ID)?.status).toBe("changes_requested");
});

it("stamps nothing when the step append fails, so the request can be retried", async () => {
  const anchor = currentAnchor();
  const comment = review.addComment(run(), {
    file_path: "notes.md",
    line: 2,
    diff_sha: anchor.sha,
    body: "fix me",
  });
  const failing = createReviewService({
    ...reviewConfig,
    appendRunStep: async () => {
      throw new Error("append exploded");
    },
  });

  await expect(
    failing.requestFix(run(), { commentIds: [comment.id], selector: FIX_AGENT }),
  ).rejects.toThrow("append exploded");

  expect(getReviewComment(fix.db, comment.id)?.fix_requested_at).toBeNull();
  expect(getReviewForRun(fix.db, RUN_ID)?.status).toBe("in_review");
});

it("on a completed settle: emits git.diff_updated, marks fixed comments addressed and moved anchors outdated", async () => {
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
  await review.requestFix(run(), { commentIds: [requested.id], selector: FIX_AGENT });

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

it("releases pending fix requests when the turn does not complete", async () => {
  const anchor = currentAnchor();
  const comment = review.addComment(run(), {
    file_path: "notes.md",
    line: 2,
    diff_sha: anchor.sha,
    body: "fix me",
  });
  await review.requestFix(run(), { commentIds: [comment.id], selector: FIX_AGENT });

  review.onRunSettled({ runId: RUN_ID, classification: "interrupted" });

  const row = getReviewComment(fix.db, comment.id);
  expect(row?.status).toBe("open");
  expect(row?.fix_requested_at).toBeNull();
});
