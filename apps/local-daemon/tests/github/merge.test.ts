import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getIssue, getPullRequest, getRun } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { createRepositoryResolver } from "#git";
import { createGitHubService, GitHubPublicationError, type GitHubService } from "#github";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { FakeGitHubCli, providerPullRequest } from "../support/github.js";
import { seedRun } from "../support/seed.js";

const ISSUE_ID = "i1";
const RUN_ID = "r-merging";

let fix: DaemonTestDb;
let cli: FakeGitHubCli;
let github: GitHubService;
let remotePath: string;
let headSha: string;

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).toString();
}

function publishBranch(): string {
  remotePath = mkdtempSync(join(tmpdir(), "otomat-remote-"));
  git(remotePath, "init", "--bare", "-b", "main");
  git(fix.repo.root, "remote", "add", "origin", remotePath);
  git(fix.repo.root, "push", "origin", "main");

  fix.repo.git("checkout", "-b", "contrib/fix");
  fix.repo.write("contributed.txt", "from the contributor\n");
  const sha = fix.repo.commitAll("contributor change");
  git(fix.repo.root, "push", "origin", "contrib/fix:refs/pull/7/head");
  fix.repo.git("checkout", "main");
  fix.repo.git("branch", "-D", "contrib/fix");
  return sha;
}

async function attach(): Promise<string> {
  return (await github.attachPullRequest(ISSUE_ID, { reference: "#7" })).id;
}

beforeEach(() => {
  fix = setupDaemonDb();
  headSha = publishBranch();
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
    headRef: "contrib/fix",
    headSha,
    authorLogin: "contrib",
  });
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

afterEach(() => {
  fix.cleanup();
  rmSync(remotePath, { recursive: true, force: true });
});

it("answers an overview with the facts GitHub reports and the merge it refuses", async () => {
  const id = await attach();
  cli.overviewFacts = {
    pullRequest: cli.provider,
    checks: [{ name: "build", state: "failing", url: "https://gh/checks/1" }],
    reviews: [{ author_login: "octocat", state: "approved", submitted_at: null }],
    commits: 3,
    changedFiles: 2,
    additions: 12,
    deletions: 4,
    mergeState: "BEHIND",
  };

  const overview = await github.pullRequestOverview(id);
  expect(overview).toMatchObject({
    repository: "acme/otomat",
    commits: 3,
    changedFiles: 2,
    additions: 12,
    deletions: 4,
    behindBase: true,
  });
  expect(overview.checks[0]).toEqual({
    name: "build",
    state: "failing",
    url: "https://gh/checks/1",
  });
  expect(overview.reviews[0]?.author_login).toBe("octocat");
  // The branch belongs to @contrib, so no authority is proven whatever GitHub allows.
  expect(overview.merge.blocker).toBe("not_authorized");
  expect(overview.merge.methods).toEqual([]);
});

it("refuses to merge a pull request Otomat has no authority over", async () => {
  const id = await attach();
  await expect(github.mergePullRequest(id, "squash")).rejects.toThrow(GitHubPublicationError);
  expect(cli.merges).toEqual([]);
});

it("refuses a method the repository does not allow", async () => {
  cli.provider = { ...cli.provider, authorLogin: "octocat" };
  const id = await attach();
  cli.mergePolicy = { methods: ["squash"], canPush: true };

  await expect(github.mergePullRequest(id, "merge")).rejects.toThrow(/does not allow a merge/);
  expect(cli.merges).toEqual([]);
});

it("merges on GitHub and lets the refresh close the issue's cycle", async () => {
  cli.provider = { ...cli.provider, authorLogin: "octocat" };
  const id = await attach();

  const merged = await github.mergePullRequest(id, "squash");

  expect(cli.merges).toEqual([
    { cwd: fix.repo.root, repository: "acme/otomat", number: 7, method: "squash" },
  ]);
  expect(merged.status).toBe("merged");
  expect(getPullRequest(fix.db, id)?.status).toBe("merged");
  expect(getIssue(fix.db, ISSUE_ID)?.status).toBe("done");
  expect(getRun(fix.db, RUN_ID)?.status).toBe("completed");
});

it("refuses a second merge on a pull request GitHub already merged", async () => {
  cli.provider = { ...cli.provider, authorLogin: "octocat" };
  const id = await attach();
  await github.mergePullRequest(id, "squash");
  cli.merges.length = 0;

  await expect(github.mergePullRequest(id, "squash")).rejects.toThrow(/merged/);
  expect(cli.merges).toEqual([]);
});
