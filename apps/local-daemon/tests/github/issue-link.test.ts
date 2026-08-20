import { join } from "node:path";

import { getPullRequest, schema, writeGitHubViewer, type PullRequestRow } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { createRepositoryResolver } from "#git";
import { createGitHubService, type GitHubService } from "#github";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { FakeGitHubCli } from "../support/github.js";

let fix: DaemonTestDb;
let github: GitHubService;

function seedIssue(id: string, identifier: string, title: string): void {
  fix.db
    .insert(schema.issues)
    .values({ id, project_id: "p1", title, source: "linear", source_identifier: identifier })
    .run();
}

let seeded = 0;

function seedPullRequest(values: Partial<typeof schema.pullRequests.$inferInsert>): PullRequestRow {
  const id = String(values.id ?? "pr-1");
  seeded += 1;
  fix.db
    .insert(schema.pullRequests)
    .values({
      id,
      repository_id: fix.repositoryId,
      provider: "github",
      origin: "imported",
      provenance: "external",
      author_login: "contrib",
      number: seeded,
      url: `https://github.com/acme/otomat/pull/${seeded}`,
      status: "open",
      title: "Contributor fix",
      ...values,
    })
    .run();
  const row = getPullRequest(fix.db, id);
  if (row === undefined) throw new Error(`pull request ${id} was not seeded`);
  return row;
}

beforeEach(() => {
  fix = setupDaemonDb();
  seeded = 0;
  github = createGitHubService({
    db: fix.db,
    dataDir: fix.dataDir,
    repositories: createRepositoryResolver({
      db: fix.db,
      worktreesRoot: join(fix.dataDir, "worktrees"),
    }),
    cli: new FakeGitHubCli(),
  });
  seedIssue("i-one", "OTO-1", "First issue");
  seedIssue("i-two", "OTO-2", "Second issue");
});

afterEach(() => fix.cleanup());

it("reads the link the row carries as the attachment it is", () => {
  const row = seedPullRequest({ issue_id: "i-one", title: "Nothing to parse here" });

  expect(github.pullRequestIssue(row)).toEqual({
    id: "i-one",
    identifier: "OTO-1",
    title: "First issue",
    status: "backlog",
    evidence: "attachment",
  });
});

it("resolves one exact identifier from the title, the body or the branch", () => {
  const fromTitle = seedPullRequest({ id: "pr-title", title: "fix(inbox): repair OTO-1" });
  const fromBody = seedPullRequest({ id: "pr-body", title: "chore: sweep", body: "Refs OTO-1" });
  const fromBranch = seedPullRequest({ id: "pr-branch", title: "chore", head_ref: "feat/OTO-1" });

  for (const row of [fromTitle, fromBody, fromBranch]) {
    expect(github.pullRequestIssue(row)).toMatchObject({ id: "i-one", evidence: "reference" });
  }
});

it("links nothing when the evidence is ambiguous or names no mirrored issue", () => {
  const ambiguous = seedPullRequest({ id: "pr-two", body: "Refs OTO-1 and OTO-2" });
  const unknown = seedPullRequest({ id: "pr-unknown", title: "Refs ABC-9" });
  const silent = seedPullRequest({ id: "pr-silent", title: "chore: sweep", head_ref: "sweep" });

  expect(github.pullRequestIssue(ambiguous)).toBeNull();
  expect(github.pullRequestIssue(unknown)).toBeNull();
  expect(github.pullRequestIssue(silent)).toBeNull();
});

it("answers the reviewer exactly what the inbox shows for the same pull request", () => {
  writeGitHubViewer(fix.db, { login: "octocat", teams: [] });
  const row = seedPullRequest({ head_ref: "feat/OTO-1", author_login: "octocat" });

  const [entry] = github.pullRequestInbox("p1").entries;

  expect(entry?.issue).toEqual(github.pullRequestIssue(row));
  expect(entry?.issue).toMatchObject({ identifier: "OTO-1", evidence: "reference" });
});
