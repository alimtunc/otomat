import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { insertPullRequest, listReviewedFilesForSubject, writeGitHubViewer } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { createRepositoryResolver, type GitWorktreeService } from "#git";
import {
  createReviewService,
  type ReviewService,
  type ReviewServiceConfig,
  type ReviewSubjectRef,
  type ViewedFileState,
  type ViewedFilesResult,
} from "#review";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { seedRun } from "../support/seed.js";

const RUN_ID = "r-reviewed";
const BRANCH = "otomat/run/r-reviewed";
const PULL_REQUEST_ID = "pr-reviewed";
const RUN: ReviewSubjectRef = { kind: "run", id: RUN_ID };

let fix: DaemonTestDb;
let worktrees: GitWorktreeService;
let worktreePath = "";
let review: ReviewService;
let config: ReviewServiceConfig;
let synced: { pullRequestId: string; input: ViewedFileState }[] = [];
let syncFailure: Error | null = null;
let syncLogin = "octocat";
let remote: ViewedFilesResult = { viewerLogin: "octocat", files: [] };

beforeEach(() => {
  fix = setupDaemonDb();
  const repositories = createRepositoryResolver({
    db: fix.db,
    worktreesRoot: join(fix.dataDir, "worktrees"),
  });
  const binding = repositories.forRepository("repo-1");
  if (!binding) throw new Error("repo-1 binding missing");
  worktrees = binding.service;
  synced = [];
  syncFailure = null;
  syncLogin = "octocat";
  remote = { viewerLogin: "octocat", files: [] };
  config = {
    db: fix.db,
    dataDir: fix.dataDir,
    repositories,
    appendRunStep: () => Promise.reject(new Error("not used")),
    submitPullRequestReview: () => Promise.reject(new Error("not used")),
    syncViewedFile: async (pullRequestId, input) => {
      synced.push({ pullRequestId, input });
      if (syncFailure !== null) throw syncFailure;
      return syncLogin;
    },
    readViewedFiles: async () => remote,
  };
  review = createReviewService(config);

  const acquired = worktrees.acquire({ owner: RUN_ID, branch: BRANCH });
  worktreePath = acquired.path;
  seedRun(fix.db, {
    runId: RUN_ID,
    repositoryId: "repo-1",
    worktreeId: acquired.id,
    runStatus: "review_ready",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
  });
  writeFileSync(join(worktreePath, "notes.md"), "alpha\nbeta\n");
  writeFileSync(join(worktreePath, "other.md"), "one\n");
});

afterEach(() => {
  fix.cleanup();
});

function fileSha(path: string): string {
  const file = review.getDiff(RUN).diff?.files.find((candidate) => candidate.path === path);
  if (!file) throw new Error(`expected ${path} in the diff`);
  return file.sha;
}

function markReviewed(path: string, reviewed = true) {
  return review.setReviewedFile(RUN, { file_path: path, diff_sha: fileSha(path), reviewed });
}

function openPullRequest(): void {
  insertPullRequest(fix.db, {
    id: PULL_REQUEST_ID,
    issue_id: "i1",
    run_id: RUN_ID,
    number: 9,
    node_id: "PR_node_9",
    url: "https://github.com/acme/app/pull/9",
    status: "open",
    publication_status: "created",
    title: "Notes",
    head_ref: BRANCH,
  });
}

it("keeps a mark across daemon restarts while the file reads the same", async () => {
  const sha = fileSha("notes.md");
  await markReviewed("notes.md");

  const restarted = createReviewService(config);
  const detail = restarted.getReviewDetail(RUN);
  expect(detail.reviewedFiles).toHaveLength(1);
  expect(detail.reviewedFiles[0]).toMatchObject({
    file_path: "notes.md",
    diff_sha: sha,
    reviewed: true,
    sync_status: "local",
  });
});

it("pins the mark to the content it was made against, leaving the other files alone", async () => {
  const staleSha = fileSha("notes.md");
  await markReviewed("notes.md");
  await markReviewed("other.md");

  writeFileSync(join(worktreePath, "notes.md"), "alpha\nbeta\ndelta\n");
  const marks = review.getReviewDetail(RUN).reviewedFiles;
  const live = new Map(review.getDiff(RUN).diff?.files.map((file) => [file.path, file.sha]));

  expect(marks.find((mark) => mark.file_path === "notes.md")?.diff_sha).toBe(staleSha);
  expect(live.get("notes.md")).not.toBe(staleSha);
  expect(live.get("other.md")).toBe(marks.find((mark) => mark.file_path === "other.md")?.diff_sha);
});

it("stays local while no pull request carries the mark, then synchronizes once one does", async () => {
  const beforePullRequest = await markReviewed("notes.md");
  expect(beforePullRequest.sync_status).toBe("local");
  expect(synced).toHaveLength(0);

  openPullRequest();
  const afterPullRequest = await markReviewed("other.md");
  expect(afterPullRequest).toMatchObject({ sync_status: "synced", viewer_login: "octocat" });
  expect(synced).toEqual([
    { pullRequestId: PULL_REQUEST_ID, input: { path: "other.md", viewed: true } },
  ]);
});

it("unmarks through GitHub rather than forgetting the file", async () => {
  openPullRequest();
  await markReviewed("notes.md");
  const unmarked = await markReviewed("notes.md", false);

  expect(unmarked).toMatchObject({ reviewed: false, sync_status: "synced" });
  expect(synced.at(-1)?.input).toEqual({ path: "notes.md", viewed: false });
});

it("keeps the mark and the reason when GitHub refuses, and retries on the same call", async () => {
  openPullRequest();
  syncFailure = new Error("GitHub is unreachable.");
  const refused = await markReviewed("notes.md");

  expect(refused).toMatchObject({
    reviewed: true,
    sync_status: "failed",
    sync_error: "GitHub is unreachable.",
  });

  syncFailure = null;
  const retried = await markReviewed("notes.md");
  expect(retried).toMatchObject({ sync_status: "synced", sync_error: null });
  expect(synced).toHaveLength(2);
});

it("imports the account's own viewed state when a pull request is detected", async () => {
  openPullRequest();
  remote = {
    viewerLogin: "octocat",
    files: [
      { path: "notes.md", viewed: true },
      { path: "other.md", viewed: false },
    ],
  };

  await review.importViewedFiles(PULL_REQUEST_ID);

  const marks = review.getReviewDetail(RUN).reviewedFiles;
  expect(marks.find((mark) => mark.file_path === "notes.md")).toMatchObject({
    reviewed: true,
    diff_sha: fileSha("notes.md"),
    sync_status: "synced",
    viewer_login: "octocat",
  });
  expect(marks.some((mark) => mark.file_path === "other.md")).toBe(false);
});

it("pushes the marks made before the pull request instead of letting GitHub overwrite them", async () => {
  await markReviewed("notes.md");
  openPullRequest();
  remote = { viewerLogin: "octocat", files: [{ path: "notes.md", viewed: false }] };

  await review.importViewedFiles(PULL_REQUEST_ID);

  expect(synced).toEqual([
    { pullRequestId: PULL_REQUEST_ID, input: { path: "notes.md", viewed: true } },
  ]);
  expect(review.getReviewDetail(RUN).reviewedFiles[0]).toMatchObject({
    reviewed: true,
    sync_status: "synced",
  });
});

it("retries a refused mark on the next import rather than dropping the intent", async () => {
  openPullRequest();
  syncFailure = new Error("GitHub is unreachable.");
  await markReviewed("notes.md");
  syncFailure = null;

  await review.importViewedFiles(PULL_REQUEST_ID);

  expect(review.getReviewDetail(RUN).reviewedFiles[0]).toMatchObject({
    reviewed: true,
    sync_status: "synced",
    sync_error: null,
  });
});

it("takes GitHub's answer over a mark another account left behind", async () => {
  openPullRequest();
  syncLogin = "hubot";
  await markReviewed("notes.md");

  remote = { viewerLogin: "octocat", files: [{ path: "notes.md", viewed: false }] };
  await review.importViewedFiles(PULL_REQUEST_ID);

  expect(synced).toHaveLength(1);
  expect(listReviewedFilesForSubject(fix.db, RUN_ID)[0]).toMatchObject({
    reviewed: false,
    viewer_login: "octocat",
    sync_status: "synced",
  });
});

it("never shows a mark that belongs to another GitHub account", async () => {
  openPullRequest();
  syncLogin = "octocat";
  await markReviewed("notes.md");

  writeGitHubViewer(fix.db, { login: "hubot", teams: null });
  expect(review.getReviewDetail(RUN).reviewedFiles).toEqual([]);

  writeGitHubViewer(fix.db, { login: "octocat", teams: null });
  expect(review.getReviewDetail(RUN).reviewedFiles).toHaveLength(1);
  expect(listReviewedFilesForSubject(fix.db, RUN_ID)).toHaveLength(1);
});
