import { execFileSync } from "node:child_process";
import { join } from "node:path";

import {
  getIssue,
  getPullRequest,
  getRun,
  insertPullRequest,
  listPullRequestsForIssue,
} from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { createRepositoryResolver } from "#git";
import { createGitHubService, PullRequestImportRefusal, type GitHubService } from "#github";
import { createReviewService, type ReviewService, type ViewedFilesResult } from "#review";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { FakeGitHubCli, providerPullRequest } from "../support/github.js";
import { seedRun } from "../support/seed.js";

const ISSUE_ID = "i1";
const RUN_ID = "r-adopting";

let fix: DaemonTestDb;
let cli: FakeGitHubCli;
let github: GitHubService;
let review: ReviewService;
let headSha: string;
let viewedImports: string[] = [];
let remoteViewed: ViewedFilesResult = { viewerLogin: "octocat", files: [] };

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).toString();
}

function publishContributorBranch(): string {
  fix.repo.git("checkout", "-b", "contrib/fix");
  fix.repo.write("contributed.txt", "from the contributor\n");
  const sha = fix.repo.commitAll("contributor change");
  git(fix.repo.root, "push", "origin", "contrib/fix:refs/pull/7/head");
  fix.repo.git("checkout", "main");
  fix.repo.git("branch", "-D", "contrib/fix");
  return sha;
}

beforeEach(() => {
  fix = setupDaemonDb();
  headSha = publishContributorBranch();
  seedRun(fix.db, {
    runId: RUN_ID,
    issueId: ISSUE_ID,
    runStatus: "review_ready",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
  });
  cli = new FakeGitHubCli();
  cli.provider = providerPullRequest({
    number: 7,
    url: "https://github.com/acme/otomat/pull/7",
    title: "Contributor fix",
    body: "Please review",
    headRef: "contrib/fix",
    headSha,
    authorLogin: "contrib",
  });
  const repositories = createRepositoryResolver({
    db: fix.db,
    worktreesRoot: join(fix.dataDir, "worktrees"),
  });
  viewedImports = [];
  remoteViewed = { viewerLogin: "octocat", files: [] };
  github = createGitHubService({
    db: fix.db,
    dataDir: fix.dataDir,
    repositories,
    cli,
    importViewedFiles: (pullRequestId) => viewedImports.push(pullRequestId),
  });
  review = createReviewService({
    db: fix.db,
    dataDir: fix.dataDir,
    repositories,
    appendRunStep: async () => {
      throw new Error("append not expected");
    },
    submitPullRequestReview: async () => ({ url: "https://github.com/acme/otomat/pull/7#c1" }),
    syncViewedFile: async () => "octocat",
    readViewedFiles: async () => remoteViewed,
  });
});

afterEach(() => {
  fix.cleanup();
});

it("adopts a verified pull request with its evidence and fetches its head read-only", async () => {
  const attached = await github.attachPullRequest(ISSUE_ID, { reference: "#7" });
  expect(viewedImports).toEqual([attached.id]);

  expect(attached).toMatchObject({
    issue_id: ISSUE_ID,
    run_id: null,
    origin: "imported",
    provenance: "external",
    author_login: "contrib",
    number: 7,
    head_ref: "contrib/fix",
    head_sha: headSha,
    status: "open",
  });
  expect(JSON.parse(attached.attachment_evidence ?? "{}")).toMatchObject({
    repository: "acme/otomat",
    number: 7,
    head_sha: headSha,
    discovery: "manual",
  });
  // Isolation: the head landed in a read-only ref, never a branch.
  expect(git(fix.repo.root, "rev-parse", "refs/otomat/pull/7/head").trim()).toBe(headSha);
  expect(git(fix.repo.root, "branch", "--list", "contrib/fix").trim()).toBe("");
});

it("refuses a reference it cannot verify rather than guessing", async () => {
  await expect(github.attachPullRequest(ISSUE_ID, { reference: "not-a-pr" })).rejects.toMatchObject(
    {
      code: "pr_reference_invalid",
    },
  );
  await expect(
    github.attachPullRequest(ISSUE_ID, { reference: "https://github.com/other/repo/pull/7" }),
  ).rejects.toMatchObject({ code: "pr_repository_mismatch" });

  await github.attachPullRequest(ISSUE_ID, { reference: "7" });
  await expect(github.attachPullRequest(ISSUE_ID, { reference: "7" })).rejects.toMatchObject({
    code: "pr_already_attached",
  });
});

it("reviews the imported head and refuses to rewrite the contributor's branch", async () => {
  const attached = await github.attachPullRequest(ISSUE_ID, { reference: "7" });
  const target = { kind: "pull_request", id: attached.id } as const;

  const diff = review.getDiff(target).diff;
  expect(diff?.files.map((file) => file.path)).toEqual(["contributed.txt"]);

  const detail = review.getReviewDetail(target);
  expect(detail.fixAuthority.kind).toBe("external");
  expect(detail.fixAuthority.reason).toContain("@contrib");
  expect(detail.destinations.pr_review).toBe(true);

  const file = diff?.files[0];
  if (!file) throw new Error("expected the contributed file in the diff");
  const comment = await review.addComment(target, {
    file_path: file.path,
    side: "new",
    line: 1,
    diff_sha: file.sha,
    body: "Pin me to the imported head.",
    destination: "agent",
  });
  expect(comment.diff_sha).toBe(file.sha);
  expect(review.getReviewDetail(target).comments.map((row) => row.id)).toEqual([comment.id]);
});

it("fetches and reviews a mirrored pull request that no issue and no run own", async () => {
  cli.openPullRequests = [
    { ...cli.provider, requestedReviewers: [{ kind: "user", handle: "octocat" }] },
  ];
  const inbox = await github.syncPullRequestInbox("p1");
  const entry = inbox.entries[0];
  if (!entry) throw new Error("expected the mirrored pull request in the inbox");
  expect(entry).toMatchObject({ run_id: null, issue: null, head_fetched: false });

  const fetched = await github.refreshPullRequest(entry.id);
  expect(fetched).toMatchObject({ issue_id: null, head_sha: headSha });

  const target = { kind: "pull_request", id: entry.id } as const;
  expect(review.getDiff(target).diff?.files.map((file) => file.path)).toEqual(["contributed.txt"]);
  expect(review.getReviewDetail(target).fixAuthority.kind).toBe("external");

  expect(viewedImports).toContain(entry.id);
  remoteViewed = { viewerLogin: "octocat", files: [{ path: "contributed.txt", viewed: true }] };
  await review.importViewedFiles(entry.id);
  expect(review.getReviewDetail(target).reviewedFiles).toMatchObject([
    {
      file_path: "contributed.txt",
      reviewed: true,
      sync_status: "synced",
      viewer_login: "octocat",
    },
  ]);
});

it("closes the local review and execution projection once GitHub confirms the merge", async () => {
  const attached = await github.attachPullRequest(ISSUE_ID, { reference: "7" });
  cli.provider = { ...cli.provider, lifecycle: "merged" };

  const refreshed = await github.refreshPullRequest(attached.id);

  expect(refreshed.status).toBe("merged");
  expect(getRun(fix.db, RUN_ID)?.status).toBe("completed");
  expect(getIssue(fix.db, ISSUE_ID)?.status).toBe("done");
});

it("lists only the pull requests GitHub carries, and states why detection could not run", async () => {
  const attached = await github.attachPullRequest(ISSUE_ID, { reference: "7" });
  insertPullRequest(fix.db, { id: "pr-draft", issue_id: ISSUE_ID, run_id: RUN_ID });

  const listed = await github.listIssuePullRequests(ISSUE_ID);

  expect(listed.attached.map((row) => row.id)).toEqual([attached.id]);
  expect(listed.detection.status).toBe("unavailable");
  expect(listed.detection.message).toContain("no tracker identifier");
});

it("keeps a detached attachment as history and refuses to detach Otomat's own pull request", async () => {
  const attached = await github.attachPullRequest(ISSUE_ID, { reference: "7" });

  const detached = github.detachPullRequest(attached.id);
  expect(detached.detached_at).not.toBeNull();
  expect(getPullRequest(fix.db, attached.id)).toBeDefined();
  expect(listPullRequestsForIssue(fix.db, ISSUE_ID)).toEqual([]);
  expect(() => github.detachPullRequest(attached.id)).toThrow(PullRequestImportRefusal);

  insertPullRequest(fix.db, { id: "pr-own", issue_id: ISSUE_ID, run_id: RUN_ID, number: 8 });
  expect(() => github.detachPullRequest("pr-own")).toThrow(/opened this pull request itself/);
});
