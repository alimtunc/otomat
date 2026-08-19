import { join } from "node:path";

import { findPullRequestByNumber, schema, writeGitHubViewer } from "@otomat/db";
import { pullRequestInboxSchema } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { createRepositoryResolver } from "#git";
import { createGitHubService, type GitHubService } from "#github";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { CONNECTED_GITHUB, FakeGitHubCli, providerPullRequest } from "../support/github.js";
import { seedRun } from "../support/seed.js";

let fix: DaemonTestDb;
let cli: FakeGitHubCli;
let github: GitHubService;

/** A mirrored issue the inbox can link a reference to; `i1` comes from the fixture without one. */
function seedIssue(id: string, identifier: string, title: string): void {
  fix.db
    .insert(schema.issues)
    .values({ id, project_id: "p1", title, source: "linear", source_identifier: identifier })
    .run();
}

function contributorPullRequest(overrides: Parameters<typeof providerPullRequest>[0] = {}) {
  return providerPullRequest({
    number: 7,
    url: "https://github.com/acme/otomat/pull/7",
    title: "Contributor fix",
    body: "Please review",
    headRef: "contrib/fix",
    authorLogin: "contrib",
    requestedReviewers: [{ kind: "user", handle: "octocat" }],
    ...overrides,
  });
}

beforeEach(() => {
  fix = setupDaemonDb();
  cli = new FakeGitHubCli();
  cli.connectionValue = CONNECTED_GITHUB;
  github = createGitHubService({
    db: fix.db,
    dataDir: fix.dataDir,
    repositories: createRepositoryResolver({
      db: fix.db,
      worktreesRoot: join(fix.dataDir, "worktrees"),
    }),
    cli,
  });
});

afterEach(() => fix.cleanup());

it("shows a pull request asking for the viewer's review with no run and no issue", async () => {
  cli.openPullRequests = [contributorPullRequest()];

  const inbox = await github.syncPullRequestInbox("p1");

  expect(inbox.viewer).toEqual({ login: "octocat", teams_known: true });
  expect(inbox.sync.last_error).toBeNull();
  expect(inbox.sync.last_synced_at).not.toBeNull();
  expect(inbox.entries).toEqual([
    expect.objectContaining({
      group: "needs_your_review",
      repository: "acme/otomat",
      number: 7,
      title: "Contributor fix",
      author_login: "contrib",
      provenance: "external",
      run_id: null,
      issue: null,
      head_fetched: false,
    }),
  ]);
});

it("answers a row no pass has mirrored yet within the wire contract", () => {
  writeGitHubViewer(fix.db, { login: "octocat", teams: [] });
  fix.db
    .insert(schema.pullRequests)
    .values({
      id: "pr-legacy",
      repository_id: fix.repositoryId,
      provider: "github",
      origin: "otomat",
      provenance: "otomat",
      author_login: "octocat",
      number: 4,
      url: "https://github.com/acme/otomat/pull/4",
      status: "open",
      title: "Published before the inbox existed",
    })
    .run();

  const inbox = github.pullRequestInbox("p1");

  expect(pullRequestInboxSchema.safeParse(inbox)).toMatchObject({ success: true });
  expect(inbox.entries).toEqual([
    expect.objectContaining({ number: 4, group: "waiting_for_review" }),
  ]);
});

it("mirrors without adopting: the row carries no attachment and no issue", async () => {
  cli.openPullRequests = [contributorPullRequest()];
  await github.syncPullRequestInbox("p1");

  expect(findPullRequestByNumber(fix.db, "repo-1", 7)).toMatchObject({
    origin: "imported",
    issue_id: null,
    attached_at: null,
    attachment_evidence: null,
    head_sha: null,
  });
});

it("drops a pull request from the groups once GitHub reports it merged", async () => {
  cli.openPullRequests = [contributorPullRequest()];
  await github.syncPullRequestInbox("p1");

  cli.openPullRequests = [];
  cli.provider = contributorPullRequest({ lifecycle: "merged" });
  const inbox = await github.syncPullRequestInbox("p1");

  expect(inbox.entries).toEqual([]);
  expect(findPullRequestByNumber(fix.db, "repo-1", 7)).toMatchObject({ status: "merged" });
});

it("links an issue a single reference names, and refuses an ambiguous one", async () => {
  seedIssue("i-one", "OTO-1", "First issue");
  seedIssue("i-two", "OTO-2", "Second issue");
  cli.openPullRequests = [
    contributorPullRequest({ title: "fix(inbox): repair OTO-1", number: 7 }),
    contributorPullRequest({
      number: 8,
      url: "https://github.com/acme/otomat/pull/8",
      title: "chore: sweep",
      body: "Refs OTO-1 and OTO-2",
    }),
  ];

  const inbox = await github.syncPullRequestInbox("p1");

  const [linked, ambiguous] = inbox.entries;
  expect(linked?.issue).toEqual({
    id: "i-one",
    identifier: "OTO-1",
    title: "First issue",
    status: "backlog",
    evidence: "reference",
  });
  expect(ambiguous?.issue).toBeNull();
});

it("weighs the branch too, and refuses the tokens a search would have split", async () => {
  seedIssue("i-ten", "OTO-10", "Supervisor reconciliation");
  seedIssue("i-anti-slop", "OTO-119", "Vendor anti-slop");
  cli.openPullRequests = [
    contributorPullRequest({ title: "chore: sweep", headRef: "feat/oto-119-lint" }),
    contributorPullRequest({
      number: 8,
      url: "https://github.com/acme/otomat/pull/8",
      title: "feat(supervisor): reconcile pids",
      body: "Refs OTO-10\n\nThe daemon 119 tests still pass.",
      headRef: "oto-10-supervisor-pid-reconciliation",
    }),
  ];

  const inbox = await github.syncPullRequestInbox("p1");

  const [byBranch, tokenized] = inbox.entries;
  expect(byBranch?.issue).toMatchObject({ id: "i-anti-slop", evidence: "reference" });
  expect(tokenized?.issue).toMatchObject({ id: "i-ten", evidence: "reference" });
});

it("lets the title and the body decide, so a stale branch name cannot unlink a named issue", async () => {
  seedIssue("i-ten", "OTO-10", "Supervisor reconciliation");
  seedIssue("i-anti-slop", "OTO-119", "Vendor anti-slop");
  cli.openPullRequests = [
    contributorPullRequest({
      title: "chore: sweep",
      body: "Refs OTO-119",
      headRef: "oto-10-leftover-branch",
    }),
  ];

  const inbox = await github.syncPullRequestInbox("p1");

  expect(inbox.entries[0]?.issue).toMatchObject({ id: "i-anti-slop", evidence: "reference" });
});

it("reads a lowercase mention in prose as prose, so it cannot make one named issue read as two", async () => {
  seedIssue("i-ten", "OTO-118", "Supervisor reconciliation");
  seedIssue("i-anti-slop", "OTO-119", "Vendor anti-slop");
  cli.openPullRequests = [
    contributorPullRequest({
      title: "OTO-119: split the detector",
      body: "Supersedes oto-118; that branch is stale.",
      headRef: "feat/detector",
    }),
  ];

  const inbox = await github.syncPullRequestInbox("p1");

  expect(inbox.entries[0]?.issue).toMatchObject({ id: "i-anti-slop", evidence: "reference" });
});

it("reads an Otomat-owned branch as its own work without inventing a publication", async () => {
  seedRun(fix.db, {
    runId: "r1",
    issueId: "i1",
    runStatus: "review_ready",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
  });
  cli.openPullRequests = [
    contributorPullRequest({
      authorLogin: "octocat",
      headRef: "otomat/run/r1",
      requestedReviewers: [],
      reviewDecision: "approved",
      checksState: "passing",
      mergeable: "mergeable",
    }),
  ];

  const inbox = await github.syncPullRequestInbox("p1");

  expect(inbox.entries).toEqual([
    expect.objectContaining({ group: "ready_to_merge", provenance: "otomat", run_id: null }),
  ]);
});

it("keeps the entries it had when GitHub refuses, and carries the reason", async () => {
  cli.openPullRequests = [contributorPullRequest()];
  await github.syncPullRequestInbox("p1");

  cli.listError = new Error("gh: API rate limit exceeded");
  const inbox = await github.syncPullRequestInbox("p1");

  expect(inbox.sync.last_error).toEqual({ message: "gh: API rate limit exceeded" });
  expect(inbox.entries).toHaveLength(1);
});

it("says nothing rather than guessing when the account is not connected", async () => {
  cli.connectionValue = { ...CONNECTED_GITHUB, status: "disconnected", login: null };
  cli.openPullRequests = [contributorPullRequest()];

  const inbox = await github.syncPullRequestInbox("p1");

  expect(inbox.viewer).toEqual({ login: null, teams_known: false });
  expect(inbox.entries).toEqual([]);
});

it("states that team membership is unknown instead of reading it as none", async () => {
  cli.teams = null;
  cli.openPullRequests = [
    contributorPullRequest({ requestedReviewers: [{ kind: "team", handle: "acme/core" }] }),
  ];

  const inbox = await github.syncPullRequestInbox("p1");

  expect(inbox.viewer.teams_known).toBe(false);
  expect(inbox.entries).toEqual([]);
});
