import { appendFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  getPullRequestForRun,
  getReviewComment,
  getReviewForSubject,
  getRun,
  insertPullRequest,
  setReviewCommentFixRequested,
  setReviewCommentPublication,
  updatePullRequest,
  updateReviewCommentStatus,
  writeGitHubViewer,
  type ReviewCommentRow,
} from "@otomat/db";
import { BRANCH_DIFF_SCOPE, type CreateReviewCommentRequest } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { readRunEvents } from "#events";
import { createRepositoryResolver, type GitWorktreeService } from "#git";
import {
  CommentDestinationUnavailableError,
  CommentRangeInvalidError,
  createReviewService,
  DiffUnavailableError,
  FileNotInDiffError,
  ReviewAnchorStaleError,
  CommentsNotFixableError,
  ReviewSubmissionBusyError,
  ReviewSubmissionEmptyError,
  ReviewSubmissionFailedError,
  ReviewSubmissionUnavailableError,
  type PullRequestReviewSubmission,
  type ReviewService,
  type ReviewServiceConfig,
  type ReviewSubjectRef,
} from "#review";
import type { AppendStepInput } from "#supervisor";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { seedRun } from "../support/seed.js";

const RUN_ID = "r-review";
const SESSION_ID = `${RUN_ID}-session`;
const BRANCH = "otomat/run/r-review";
const FIX_AGENT = { kind: "runtime", runtimeId: "fake" } as const;

let fix: DaemonTestDb;
let worktrees: GitWorktreeService;
let review: ReviewService;
let reviewConfig: ReviewServiceConfig;
let appended: AppendStepInput[] = [];
let submissions: PullRequestReviewSubmission[] = [];
let submitFailure: Error | null = null;
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
  submissions = [];
  submitFailure = null;
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
    submitPullRequestReview: async (_pullRequestId, input) => {
      submissions.push(input);
      if (submitFailure !== null) throw submitFailure;
      return { url: "https://github.com/acme/app/pull/7#pullrequestreview-1" };
    },
    syncViewedFile: async () => "octocat",
    readViewedFiles: async () => ({ viewerLogin: "octocat", files: [] }),
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

const runTarget = (id: string = RUN_ID): ReviewSubjectRef => ({ kind: "run", id });

/** Every field the daemon needs; a test names only the anchor it is about. */
async function addComment(
  target: ReviewSubjectRef,
  input: Omit<CreateReviewCommentRequest, "side" | "destination"> &
    Partial<Pick<CreateReviewCommentRequest, "side" | "destination">>,
): Promise<ReviewCommentRow> {
  return review.addComment(target, { side: "new", destination: "agent", ...input });
}

function currentAnchor() {
  const diff = review.getDiff(runTarget()).diff;
  const file = diff?.files.find((f) => f.path === "notes.md");
  if (!file) throw new Error("expected notes.md in the diff");
  return file;
}

it("computes the real git diff for the run's worktree and null without one", () => {
  const withWorktree = review.getDiff(runTarget());
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
  expect(bare && review.getDiff(runTarget("r-bare")).diff).toBeNull();
});

it("pins a comment to the live diff, snapshots its hunk, and opens the review", async () => {
  const anchor = currentAnchor();
  const comment = await addComment(runTarget(), {
    file_path: "notes.md",
    line: 2,
    diff_sha: anchor.sha,
    body: "beta should be delta",
  });

  expect(comment.status).toBe("open");
  expect(comment.diff_sha).toBe(anchor.sha);
  expect(comment.hunk_snapshot).toContain("+beta");

  expect(getReviewForSubject(fix.db, RUN_ID)?.status).toBe("in_review");

  const events = readRunEvents(fix.db, RUN_ID);
  const created = events.find((e) => e.type === "review.comment_created");
  expect(created?.payload["comment_id"]).toBe(comment.id);
});

it("rejects a stale anchor and a run without a diff — no silent re-anchoring", async () => {
  await expect(
    addComment(runTarget(), {
      file_path: "notes.md",
      line: 1,
      diff_sha: "not-the-current-sha",
      body: "stale",
    }),
  ).rejects.toThrow(ReviewAnchorStaleError);

  seedRun(fix.db, {
    runId: "r-bare2",
    repositoryId: null,
    runStatus: "review_ready",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
  });
  const bare = getRun(fix.db, "r-bare2");
  if (!bare) throw new Error("seeded bare run missing");
  await expect(
    addComment(runTarget("r-bare2"), { file_path: "x", line: 0, diff_sha: "s", body: "b" }),
  ).rejects.toThrow(DiffUnavailableError);
});

it("pins a whole-file comment without capturing a hunk snapshot", async () => {
  const anchor = currentAnchor();
  const comment = await addComment(runTarget(), {
    file_path: "notes.md",
    line: null,
    diff_sha: anchor.sha,
    body: "This file needs a header.",
  });

  expect(comment.line).toBeNull();
  expect(comment.hunk_snapshot).toBe("");
  expect(review.getReviewDetail(runTarget()).comments.map((c) => c.id)).toEqual([comment.id]);
});

it("serves the exact base and head blobs of a live diff file", () => {
  const blobs = review.getFileBlobs(runTarget(), {
    path: "notes.md",
    sha: currentAnchor().sha,
    scope: BRANCH_DIFF_SCOPE,
  });

  expect(blobs.base).toBeNull();
  expect(blobs.head).toEqual({ kind: "text", content: "alpha\nbeta\ngamma\n" });
});

it("serves supported binary media as exact bytes", () => {
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 1]);
  writeFileSync(join(worktreePath, "preview.png"), bytes);
  const file = review
    .getDiff(runTarget())
    .diff?.files.find((candidate) => candidate.path === "preview.png");
  if (!file) throw new Error("expected preview.png in the diff");

  const blobs = review.getFileBlobs(runTarget(), {
    path: file.path,
    sha: file.sha,
    scope: BRANCH_DIFF_SCOPE,
  });

  expect(blobs.base).toBeNull();
  expect(blobs.head).toEqual({ kind: "media", data: bytes, mediaType: "image/png" });
});

it("refuses blobs read against a moved anchor", () => {
  expect(() =>
    review.getFileBlobs(runTarget(), { path: "notes.md", sha: "moved", scope: BRANCH_DIFF_SCOPE }),
  ).toThrow(ReviewAnchorStaleError);
});

it("refuses a path that is not part of the current diff", () => {
  expect(() =>
    review.getFileBlobs(runTarget(), {
      path: "absent.md",
      sha: currentAnchor().sha,
      scope: BRANCH_DIFF_SCOPE,
    }),
  ).toThrow(FileNotInDiffError);
});

it("reads a modified file's base side from the fork point, not from the worktree", () => {
  writeFileSync(join(worktreePath, "README.md"), "# base\nplus a line\n");
  const file = review.getDiff(runTarget()).diff?.files.find((f) => f.path === "README.md");
  if (!file) throw new Error("expected README.md in the diff");

  const blobs = review.getFileBlobs(runTarget(), {
    path: "README.md",
    sha: file.sha,
    scope: BRANCH_DIFF_SCOPE,
  });

  expect(blobs.base).toEqual({ kind: "text", content: "# base\n" });
  expect(blobs.head).toEqual({ kind: "text", content: "# base\nplus a line\n" });
});

it("grants fix authority only while Otomat still holds the run's worktree", () => {
  expect(review.getReviewDetail(runTarget()).fixAuthority.kind).toBe("otomat");

  worktrees.cleanup(RUN_ID);

  const authority = review.getReviewDetail(runTarget()).fixAuthority;
  expect(authority.kind).toBe("external");
  expect(authority.reason).toContain(BRANCH);
});

it("appends one fix step carrying comment + original hunk + current file", async () => {
  const anchor = currentAnchor();
  const comment = await addComment(runTarget(), {
    file_path: "notes.md",
    line: 2,
    diff_sha: anchor.sha,
    body: "beta should be delta",
  });

  await review.requestFix(run(), {
    selector: FIX_AGENT,
    overrides: {},
    note: null,
    references: [],
  });

  const step = appended[0];
  if (!step) throw new Error("expected an appended fix step");
  expect(step.name).toBe("Fix review comments");
  expect(step.origin).toBe("review_fix");
  expect(step.selector).toEqual(FIX_AGENT);
  // A fix step adds no invented instruction: the frozen comments are its context.
  expect(step.note).toBeNull();
  expect(step.reviewComments).toEqual([
    {
      id: comment.id,
      file_path: "notes.md",
      line: 2,
      start_line: null,
      side: "new",
      body: "beta should be delta",
      suggestion: null,
      suggestion_original: null,
      // The diff the comment was made against is frozen with it, named by its sha.
      diff_sha: anchor.sha,
      hunk: expect.stringContaining("+beta"),
      current_file: "alpha\nbeta\ngamma\n",
    },
  ]);
  // The fix waits on the succeeded step that produced that diff.
  expect(step.dependsOn).toEqual([`${RUN_ID}-step`]);

  // Stamped by this very request, the comment is no longer eligible for a second one.
  await expect(
    review.requestFix(run(), {
      selector: FIX_AGENT,
      overrides: {},
      note: null,
      references: [],
    }),
  ).rejects.toThrow(CommentsNotFixableError);
});

it("freezes every open agent comment and leaves the ineligible ones alone", async () => {
  openPullRequest();
  const anchor = currentAnchor();
  const body = (text: string) => ({
    file_path: "notes.md",
    line: 2,
    diff_sha: anchor.sha,
    body: text,
  });

  const first = await addComment(runTarget(), body("beta should be delta"));
  const second = await addComment(runTarget(), body("and gamma too"));
  const onPr = await addComment(runTarget(), {
    ...body("on the PR"),
    destination: "pr_review" as const,
  });
  const addressed = await addComment(runTarget(), body("already done"));
  updateReviewCommentStatus(fix.db, addressed.id, "addressed");
  const outdated = await addComment(runTarget(), body("anchor moved"));
  updateReviewCommentStatus(fix.db, outdated.id, "outdated");
  const requested = await addComment(runTarget(), body("a pass already has this"));
  setReviewCommentFixRequested(fix.db, requested.id, new Date().toISOString());

  await review.requestFix(run(), {
    selector: FIX_AGENT,
    overrides: {},
    note: null,
    references: [],
  });

  expect(appended[0]?.reviewComments?.map((frozen) => frozen.id)).toEqual([first.id, second.id]);
  for (const untouched of [onPr, addressed, outdated]) {
    expect(getReviewComment(fix.db, untouched.id)?.fix_requested_at).toBeNull();
  }
});

it("keeps fix authority on a published branch GitHub renamed under it", () => {
  openPullRequest("feat/diff-content-search");

  const authority = review.getReviewDetail(runTarget()).fixAuthority;
  expect(authority.kind).toBe("otomat");
  expect(authority.reason).toContain(BRANCH);
});

it("keeps a symlinked path's fix context to the link target text, never the host file", async () => {
  const secretPath = join(fix.dataDir, "secret.txt");
  writeFileSync(secretPath, "TOP-SECRET\n");
  symlinkSync(secretPath, join(worktreePath, "leak"));

  const anchor = review.getDiff(runTarget()).diff?.files.find((f) => f.path === "leak");
  if (!anchor) throw new Error("expected leak in the diff");
  await addComment(runTarget(), {
    file_path: "leak",
    line: null,
    diff_sha: anchor.sha,
    body: "What does this point at?",
  });

  await review.requestFix(run(), {
    selector: FIX_AGENT,
    overrides: {},
    note: null,
    references: [],
  });
  const frozen = appended[0]?.reviewComments?.[0];
  expect(frozen?.current_file).not.toContain("TOP-SECRET");
  expect(frozen?.current_file).toContain(secretPath);
});

it("stamps fix-requested comments and drives the review to changes_requested", async () => {
  const anchor = currentAnchor();
  const comment = await addComment(runTarget(), {
    file_path: "notes.md",
    line: 2,
    diff_sha: anchor.sha,
    body: "fix me",
  });

  await review.requestFix(run(), {
    selector: FIX_AGENT,
    overrides: {},
    note: null,
    references: [],
  });
  expect(getReviewComment(fix.db, comment.id)?.fix_requested_at).not.toBeNull();
  expect(getReviewForSubject(fix.db, RUN_ID)?.status).toBe("changes_requested");
});

it("stamps nothing when the step append fails, so the request can be retried", async () => {
  const anchor = currentAnchor();
  const comment = await addComment(runTarget(), {
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
    failing.requestFix(run(), {
      selector: FIX_AGENT,
      overrides: {},
      note: null,
      references: [],
    }),
  ).rejects.toThrow("append exploded");

  expect(getReviewComment(fix.db, comment.id)?.fix_requested_at).toBeNull();
  expect(getReviewForSubject(fix.db, RUN_ID)?.status).toBe("in_review");
});

it("on a completed settle: emits git.diff_updated, marks fixed comments addressed and moved anchors outdated", async () => {
  const anchor = currentAnchor();
  const requested = await addComment(runTarget(), {
    file_path: "notes.md",
    line: 2,
    diff_sha: anchor.sha,
    body: "fix me",
  });
  await review.requestFix(run(), {
    selector: FIX_AGENT,
    overrides: {},
    note: null,
    references: [],
  });
  // Written while the fix pass runs, so it carries no fix request of its own.
  const bystander = await addComment(runTarget(), {
    file_path: "notes.md",
    line: 3,
    diff_sha: anchor.sha,
    body: "just a note",
  });

  // The "fix turn" really edits the worktree, so both anchors leave the live diff.
  appendFileSync(join(worktreePath, "notes.md"), "delta\n");

  review.onRunSettled({ runId: RUN_ID, agentSessionId: SESSION_ID, classification: "completed" });

  expect(getReviewComment(fix.db, requested.id)?.status).toBe("addressed");
  expect(getReviewComment(fix.db, bystander.id)?.status).toBe("outdated");
  expect(getReviewForSubject(fix.db, RUN_ID)?.status).toBe("resolved");

  const events = readRunEvents(fix.db, RUN_ID);
  expect(events.some((e) => e.type === "git.diff_updated")).toBe(true);
  const resolutions = events
    .filter((e) => e.type === "review.comment_resolved")
    .map((e) => e.payload["resolution"]);
  expect(resolutions.toSorted()).toEqual(["addressed", "outdated"]);

  // Snapshots keep showing what the reviewer saw at comment time.
  expect(getReviewComment(fix.db, requested.id)?.hunk_snapshot).toContain("+beta");
});

it("keeps untouched anchors open across a completed settle", async () => {
  const anchor = currentAnchor();
  const comment = await addComment(runTarget(), {
    file_path: "notes.md",
    line: 1,
    diff_sha: anchor.sha,
    body: "still valid",
  });

  review.onRunSettled({ runId: RUN_ID, agentSessionId: SESSION_ID, classification: "completed" });
  expect(getReviewComment(fix.db, comment.id)?.status).toBe("open");
  expect(getReviewForSubject(fix.db, RUN_ID)?.status).toBe("in_review");
});

it("releases pending fix requests when the turn does not complete", async () => {
  const anchor = currentAnchor();
  const comment = await addComment(runTarget(), {
    file_path: "notes.md",
    line: 2,
    diff_sha: anchor.sha,
    body: "fix me",
  });
  await review.requestFix(run(), {
    selector: FIX_AGENT,
    overrides: {},
    note: null,
    references: [],
  });

  review.onRunSettled({ runId: RUN_ID, agentSessionId: SESSION_ID, classification: "interrupted" });

  const row = getReviewComment(fix.db, comment.id);
  expect(row?.status).toBe("open");
  expect(row?.fix_requested_at).toBeNull();
});

function openPullRequest(headRef: string = BRANCH): void {
  insertPullRequest(fix.db, {
    id: "pr-review",
    issue_id: "i1",
    run_id: RUN_ID,
    number: 7,
    url: "https://github.com/acme/app/pull/7",
    status: "open",
    publication_status: "created",
    title: "Notes",
    head_ref: headRef,
    published_head_sha: "f".repeat(40),
  });
}

it("anchors a multi-line range and snapshots the hunk it spans", async () => {
  const anchor = currentAnchor();
  const ranged = await addComment(runTarget(), {
    file_path: "notes.md",
    start_line: 1,
    line: 3,
    diff_sha: anchor.sha,
    body: "these three lines",
  });

  expect(ranged.start_line).toBe(1);
  expect(ranged.line).toBe(3);
  expect(ranged.hunk_snapshot).toContain("+gamma");

  const reread = createReviewService(reviewConfig)
    .getReviewDetail(runTarget())
    .comments.find((row) => row.id === ranged.id);
  expect(reread).toMatchObject({ side: "new", start_line: 1, line: 3 });
});

it("captures a suggestion with the exact lines it replaces", async () => {
  const anchor = currentAnchor();
  const suggested = await addComment(runTarget(), {
    file_path: "notes.md",
    start_line: 2,
    line: 3,
    diff_sha: anchor.sha,
    body: "",
    suggestion: "delta\nepsilon",
  });

  expect(suggested.suggestion).toBe("delta\nepsilon");
  expect(suggested.suggestion_original).toBe("beta\ngamma");
});

it("refuses a suggestion the patch cannot back, and says why", async () => {
  const anchor = currentAnchor();
  await expect(
    addComment(runTarget(), {
      file_path: "notes.md",
      side: "old",
      line: 1,
      diff_sha: anchor.sha,
      body: "",
      suggestion: "delta",
    }),
  ).rejects.toThrow(CommentRangeInvalidError);

  await expect(
    addComment(runTarget(), {
      file_path: "notes.md",
      start_line: 3,
      line: 40,
      diff_sha: anchor.sha,
      body: "",
      suggestion: "delta",
    }),
  ).rejects.toThrow(/not all inside one hunk/);
});

it("offers the PR destination only once a pull request carries a published head", async () => {
  expect(review.getReviewDetail(runTarget()).destinations.pr_review).toBe(false);
  await expect(
    addComment(runTarget(), {
      file_path: "notes.md",
      line: 2,
      diff_sha: currentAnchor().sha,
      destination: "pr_review",
      body: "on the PR",
    }),
  ).rejects.toThrow(CommentDestinationUnavailableError);

  openPullRequest();
  const destinations = review.getReviewDetail(runTarget()).destinations;
  expect(destinations.pr_review).toBe(true);
  expect(destinations.reason).toContain("#7");
});

it("refuses a whole-file anchor for the pull-request destination", async () => {
  openPullRequest();
  await expect(
    addComment(runTarget(), {
      file_path: "notes.md",
      line: null,
      diff_sha: currentAnchor().sha,
      destination: "pr_review",
      body: "whole file",
    }),
  ).rejects.toThrow(CommentRangeInvalidError);
});

it("carries the summary, the verdict and every pending comment in one submission", async () => {
  openPullRequest();
  const created = await addComment(runTarget(), {
    file_path: "notes.md",
    start_line: 1,
    line: 2,
    diff_sha: currentAnchor().sha,
    destination: "pr_review",
    body: "rename these",
    suggestion: "delta\nepsilon",
  });
  expect(created.publication_status).toBe("local");
  expect(submissions).toEqual([]);

  const detail = await review.submitReview(runTarget(), {
    body: "Two notes below.",
    event: "request_changes",
  });

  expect(submissions).toEqual([
    {
      commitSha: "f".repeat(40),
      body: "Two notes below.",
      event: "request_changes",
      comments: [
        {
          filePath: "notes.md",
          side: "new",
          startLine: 1,
          line: 2,
          body: "rename these",
          suggestion: "delta\nepsilon",
        },
      ],
    },
  ]);
  expect(detail.review?.status).toBe("changes_requested");
  expect(detail.comments[0]?.publication_status).toBe("published");
  expect(detail.comments[0]?.external_url).toContain("pullrequestreview-1");
  expect(readRunEvents(fix.db, RUN_ID).some((e) => e.type === "review.comment_published")).toBe(
    true,
  );
});

it("keeps every comment pending when GitHub refuses the review, and submits them on retry", async () => {
  openPullRequest();
  submitFailure = new Error("GitHub refused the review. (HTTP 422)");
  const created = await addComment(runTarget(), {
    file_path: "notes.md",
    line: 2,
    diff_sha: currentAnchor().sha,
    destination: "pr_review",
    body: "on the PR",
  });

  await expect(review.submitReview(runTarget(), { body: "", event: "comment" })).rejects.toThrow(
    ReviewSubmissionFailedError,
  );

  const failed = getReviewComment(fix.db, created.id);
  expect(failed?.publication_status).toBe("failed");
  expect(failed?.publication_error).toContain("HTTP 422");
  expect(failed?.body).toBe("on the PR");

  submitFailure = null;
  const detail = await review.submitReview(runTarget(), { body: "", event: "comment" });
  expect(detail.comments[0]?.publication_status).toBe("published");
  expect(detail.comments[0]?.publication_error).toBeNull();
});

it("refuses a submission with neither a summary nor a pending comment", async () => {
  openPullRequest();
  await expect(review.submitReview(runTarget(), { body: "  ", event: "comment" })).rejects.toThrow(
    ReviewSubmissionEmptyError,
  );
  expect(submissions).toEqual([]);
});

it("withholds Approve on a pull request the connected account opened", async () => {
  openPullRequest();
  writeGitHubViewer(fix.db, { login: "octocat", teams: null });
  updatePullRequest(fix.db, "pr-review", { author_login: "octocat" });

  const submission = review.getReviewDetail(runTarget()).submission;
  expect(submission.events).toEqual(["comment", "request_changes"]);
  expect(submission.reason).toContain("@octocat");

  await expect(
    review.submitReview(runTarget(), { body: "looks good", event: "approve" }),
  ).rejects.toThrow(ReviewSubmissionUnavailableError);
  expect(submissions).toEqual([]);
});

it("approves a pull request the connected account did not open", async () => {
  openPullRequest();
  writeGitHubViewer(fix.db, { login: "octocat", teams: null });
  updatePullRequest(fix.db, "pr-review", { author_login: "contrib" });

  expect(review.getReviewDetail(runTarget()).submission.events).toEqual([
    "comment",
    "request_changes",
    "approve",
  ]);

  const detail = await review.submitReview(runTarget(), { body: "lgtm", event: "approve" });
  expect(submissions).toEqual([
    { commitSha: "f".repeat(40), body: "lgtm", event: "approve", comments: [] },
  ]);
  expect(detail.review?.status).toBe("resolved");
});

it("leaves a resolved pull-request comment out of the review instead of blocking it", async () => {
  openPullRequest();
  const stale = await addComment(runTarget(), {
    file_path: "notes.md",
    line: 2,
    diff_sha: currentAnchor().sha,
    destination: "pr_review",
    body: "no longer applies",
  });
  updateReviewCommentStatus(fix.db, stale.id, "outdated");

  const detail = await review.submitReview(runTarget(), { body: "shipping", event: "comment" });
  expect(submissions).toEqual([
    { commitSha: "f".repeat(40), body: "shipping", event: "comment", comments: [] },
  ]);
  expect(detail.comments.find((c) => c.id === stale.id)?.publication_status).toBe("local");
});

it("retries a submission the daemon was killed in the middle of", async () => {
  openPullRequest();
  const comment = await addComment(runTarget(), {
    file_path: "notes.md",
    line: 2,
    diff_sha: currentAnchor().sha,
    destination: "pr_review",
    body: "carried over",
  });
  setReviewCommentPublication(fix.db, comment.id, { publication_status: "pending" });

  const detail = await review.submitReview(runTarget(), { body: "retry", event: "comment" });
  expect(submissions).toHaveLength(1);
  expect(detail.comments.find((c) => c.id === comment.id)?.publication_status).toBe("published");
});

it("refuses a second submission while the first is still in flight", async () => {
  openPullRequest();
  // Both calls are made in one tick, so the second sees the first still in flight.
  const first = review.submitReview(runTarget(), { body: "first", event: "comment" });
  const second = review.submitReview(runTarget(), { body: "second", event: "comment" });

  await expect(second).rejects.toThrow(ReviewSubmissionBusyError);
  await first;
  expect(submissions).toEqual([
    { commitSha: "f".repeat(40), body: "first", event: "comment", comments: [] },
  ]);
});

it("refuses a submission whose comment anchor moved under it", async () => {
  openPullRequest();
  await addComment(runTarget(), {
    file_path: "notes.md",
    line: 2,
    diff_sha: currentAnchor().sha,
    destination: "pr_review",
    body: "on the PR",
  });
  appendFileSync(join(worktreePath, "notes.md"), "delta\n");

  await expect(review.submitReview(runTarget(), { body: "", event: "comment" })).rejects.toThrow(
    ReviewAnchorStaleError,
  );
  expect(submissions).toEqual([]);
});

it("never turns a PR-review comment into an agent instruction", async () => {
  openPullRequest();
  await addComment(runTarget(), {
    file_path: "notes.md",
    line: 2,
    diff_sha: currentAnchor().sha,
    destination: "pr_review",
    body: "on the PR",
  });

  await expect(
    review.requestFix(run(), {
      selector: FIX_AGENT,
      overrides: {},
      note: null,
      references: [],
    }),
  ).rejects.toThrow(CommentsNotFixableError);
  expect(appended).toEqual([]);
});

it("freezes the global instruction beside the range and suggestion it constrains", async () => {
  const anchor = currentAnchor();
  await addComment(runTarget(), {
    file_path: "notes.md",
    start_line: 2,
    line: 3,
    diff_sha: anchor.sha,
    body: "rename these",
    suggestion: "delta\nepsilon",
  });

  await review.requestFix(run(), {
    selector: FIX_AGENT,
    overrides: {},
    note: "Keep the file ASCII-only.",
    references: [],
  });

  const step = appended[0];
  // The instruction is the step's own note, never merged into a comment body.
  expect(step?.note).toBe("Keep the file ASCII-only.");
  expect(step?.reviewComments?.[0]).toMatchObject({
    body: "rename these",
    start_line: 2,
    line: 3,
    side: "new",
    suggestion: "delta\nepsilon",
    suggestion_original: "beta\ngamma",
  });
});

it("keeps a submitted comment's destination and state through the review detail read", async () => {
  openPullRequest();
  const created = await addComment(runTarget(), {
    file_path: "notes.md",
    line: 2,
    diff_sha: currentAnchor().sha,
    destination: "pr_review",
    body: "on the PR",
  });
  await review.submitReview(runTarget(), { body: "", event: "comment" });

  const stored = review.getReviewDetail(runTarget()).comments.find((row) => row.id === created.id);
  expect(stored?.destination).toBe("pr_review");
  expect(stored?.publication_status).toBe("published");
  expect(getPullRequestForRun(fix.db, RUN_ID)?.number).toBe(7);
});
