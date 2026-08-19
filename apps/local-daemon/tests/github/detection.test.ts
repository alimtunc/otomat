import { join } from "node:path";

import { insertPullRequest, schema } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { createRepositoryResolver } from "#git";
import { createGitHubService, type GitHubService } from "#github";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { CONNECTED_GITHUB, FakeGitHubCli, providerPullRequest } from "../support/github.js";
import { seedRun } from "../support/seed.js";

const ISSUE_ID = "i-anti-slop";
const IDENTIFIER = "OTO-119";

let fix: DaemonTestDb;
let cli: FakeGitHubCli;
let github: GitHubService;

function seedIssue(id: string, identifier: string): void {
  fix.db
    .insert(schema.issues)
    .values({
      id,
      project_id: "p1",
      title: identifier,
      source: "linear",
      source_identifier: identifier,
    })
    .run();
}

function tokenizedHit() {
  return providerPullRequest({
    number: 18,
    url: "https://github.com/acme/otomat/pull/18",
    title: "feat(supervisor): reconcile pids",
    body: "Refs OTO-10\n\nThe daemon 119 tests still pass.",
    headRef: "oto-10-supervisor-pid-reconciliation",
    authorLogin: "contrib",
  });
}

beforeEach(() => {
  fix = setupDaemonDb();
  seedIssue(ISSUE_ID, IDENTIFIER);
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

it("asks GitHub for the identifier itself and offers nothing its tokens alone matched", async () => {
  cli.searchResults = [tokenizedHit()];

  const listed = await github.listIssuePullRequests(ISSUE_ID);

  expect(cli.searchInputs).toMatchObject([{ identifier: IDENTIFIER, repository: "acme/otomat" }]);
  expect(listed.candidates).toEqual([]);
  expect(listed.detection.status).toBe("searched");
  expect(listed.detection.message).toBe(
    "No pull request names OTO-119 in its title or body. Attach one by number or URL if it exists.",
  );
});

it("drops an approximate match rather than offering an ambiguous candidate", async () => {
  cli.searchResults = [
    providerPullRequest({ number: 20, title: "Fixes OTO-1190", headRef: "fix/OTO-1190" }),
    providerPullRequest({ number: 21, title: "Port of OTO-10-119", headRef: "port/OTO-10-119" }),
  ];

  const listed = await github.listIssuePullRequests(ISSUE_ID);

  expect(listed.candidates).toEqual([]);
});

it("offers an exact reference from each supported surface with the text it was read from", async () => {
  cli.searchResults = [
    providerPullRequest({ number: 30, title: "feat(lint): OTO-119 anti-slop", headRef: "a" }),
    providerPullRequest({
      number: 31,
      title: "Vendor anti-slop",
      body: "Refs OTO-119",
      headRef: "b",
    }),
    providerPullRequest({ number: 32, title: "Vendor anti-slop", headRef: "feat/oto-119-lint" }),
  ];

  const listed = await github.listIssuePullRequests(ISSUE_ID);

  expect(listed.candidates.map((candidate) => candidate.reference)).toEqual([
    { identifier: "OTO-119", surface: "title", excerpt: "feat(lint): OTO-119 anti-slop" },
    { identifier: "OTO-119", surface: "body", excerpt: "Refs OTO-119" },
    { identifier: "OTO-119", surface: "branch", excerpt: "feat/oto-119-lint" },
  ]);
  expect(listed.detection.message).toBe(
    "3 pull request(s) naming OTO-119 are not attached. Confirm one to attach it.",
  );
});

it("marks a pull request no run here owns as one the operator has to confirm", async () => {
  cli.searchResults = [
    providerPullRequest({
      number: 40,
      title: "Vendor anti-slop",
      body: "Refs OTO-119",
      headRef: "contrib/anti-slop",
      authorLogin: "contrib",
    }),
  ];

  const [candidate] = (await github.listIssuePullRequests(ISSUE_ID)).candidates;

  expect(candidate).toMatchObject({
    workspace_owned: false,
    provenance: "external",
    attached_pull_request_id: null,
  });
  expect(candidate?.reason).toContain("@contrib");
});

it("clears the confirmation only for what this issue's own workspace published", async () => {
  seedIssue("i-other", "OTO-120");
  seedRun(fix.db, {
    runId: "run-anti-slop",
    issueId: ISSUE_ID,
    runStatus: "review_ready",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
  });
  seedRun(fix.db, {
    runId: "run-other",
    issueId: "i-other",
    runStatus: "review_ready",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
  });
  cli.searchResults = [
    providerPullRequest({ number: 50, body: "Refs OTO-119", headRef: "otomat/run/run-anti-slop" }),
    providerPullRequest({ number: 51, body: "Refs OTO-119", headRef: "otomat/run/run-other" }),
  ];

  const listed = await github.listIssuePullRequests(ISSUE_ID);

  expect(listed.candidates.map((candidate) => candidate.workspace_owned)).toEqual([true, false]);
  expect(listed.candidates.map((candidate) => candidate.provenance)).toEqual(["otomat", "otomat"]);
});

it("names the row a candidate is already attached to instead of offering it twice", async () => {
  insertPullRequest(fix.db, {
    id: "pr-attached",
    issue_id: ISSUE_ID,
    repository_id: fix.repositoryId,
    number: 60,
    origin: "imported",
  });
  cli.searchResults = [providerPullRequest({ number: 60, body: "Refs OTO-119", headRef: "c" })];

  const listed = await github.listIssuePullRequests(ISSUE_ID);

  expect(listed.candidates[0]?.attached_pull_request_id).toBe("pr-attached");
  expect(listed.detection.message).toBe("Every pull request naming OTO-119 is already attached.");
});
