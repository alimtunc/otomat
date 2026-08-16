import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { getRun, schema } from "@otomat/db";
import type { PreparePullRequestRequest } from "@otomat/domain";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createGitWorktreeService, type GitWorktreeService } from "#git";
import { createGitHubService, type GitHubService } from "#github";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { stubRepositoryResolver, type TestRepo } from "../support/git.js";
import { FakeGitHubCli } from "../support/github.js";
import { seedRun } from "../support/seed.js";

const RUN_ID = "r-commit";
const BRANCH = `otomat/run/${RUN_ID}`;
const REQUEST: PreparePullRequestRequest = {
  title: "feat(pr): publish in one action (OTO-81)",
  body: "Details",
  mode: "ready",
};

describe("the publication commit", () => {
  let fix: DaemonTestDb;
  let repo: TestRepo;
  let worktrees: GitWorktreeService;
  let worktreePath: string;
  let cli: FakeGitHubCli;
  let github: GitHubService;

  beforeEach(() => {
    fix = setupDaemonDb();
    repo = fix.repo;
    worktrees = createGitWorktreeService({
      db: fix.db,
      repositoryId: "repo-1",
      repoRoot: repo.root,
      defaultBranch: repo.defaultBranch,
      worktreesRoot: join(fix.dataDir, "worktrees"),
    });
    const acquired = worktrees.acquire({ owner: RUN_ID, branch: BRANCH });
    worktreePath = acquired.path;
    seedRun(fix.db, {
      runId: RUN_ID,
      worktreeId: acquired.id,
      runStatus: "review_ready",
      stepStatus: "succeeded",
      sessionStatus: "terminated",
    });
    fix.db
      .update(schema.issues)
      .set({ source_identifier: "OTO-81" })
      .where(eq(schema.issues.id, "i1"))
      .run();
    writeFileSync(join(worktreePath, "change.txt"), "first\n");
    cli = new FakeGitHubCli();
    cli.provider = { ...cli.provider, headRef: BRANCH };
    github = createGitHubService({
      db: fix.db,
      dataDir: fix.dataDir,
      repositories: stubRepositoryResolver(worktrees),
      cli,
      idFactory: () => "pr-local-1",
    });
  });

  afterEach(() => {
    fix.cleanup();
  });

  const currentRun = () => {
    const row = getRun(fix.db, RUN_ID);
    if (!row) throw new Error("seeded run missing");
    return row;
  };

  const lastMessage = (): string => repo.git("-C", worktreePath, "log", "--format=%B", "-1").trim();

  it("never publishes the internal snapshot subject", async () => {
    await github.publish(currentRun(), REQUEST);

    expect(lastMessage()).not.toContain("otomat: snapshot");
  });

  it("derives the subject from the title and links the issue in a footer", async () => {
    await github.publish(currentRun(), REQUEST);

    expect(lastMessage()).toBe("feat(pr): publish in one action\n\nRefs OTO-81");
  });

  it("commits the proposal's own subject and body when one was generated", async () => {
    fix.db
      .insert(schema.pullRequests)
      .values({
        id: "pr-local-1",
        run_id: RUN_ID,
        title: REQUEST.title,
        commit_subject: "feat(publication): compose the commit",
        commit_body: "The generator wrote this paragraph.",
      })
      .run();

    await github.publish(currentRun(), REQUEST);

    expect(lastMessage()).toBe(
      "feat(publication): compose the commit\n\nThe generator wrote this paragraph.\n\nRefs OTO-81",
    );
  });

  it("leaves the user's own commits untouched when the workspace is clean", async () => {
    repo.git("-C", worktreePath, "add", "-A");
    repo.git(
      "-C",
      worktreePath,
      "commit",
      "--no-verify",
      "-m",
      "feat(app): the agent's own commit",
    );

    await github.publish(currentRun(), REQUEST);

    expect(lastMessage()).toBe("feat(app): the agent's own commit");
  });

  it("refuses a subject the repository's convention would reject, before any push", async () => {
    for (const subject of [
      "feat(a): one",
      "fix(b): two",
      "chore(c): three",
      "docs(d): four",
      "refactor(e): five",
    ]) {
      repo.write(`${subject.slice(0, 5)}.txt`, subject);
      repo.commitAll(subject);
    }
    repo.git("-C", worktreePath, "merge", "--ff-only", repo.defaultBranch);

    const view = await github.publish(currentRun(), { ...REQUEST, title: "Publish in one action" });

    expect(view.row.publication_status).toBe("failed");
    expect(view.row.error_code).toBe("commit_convention_violation");
    expect(cli.pushedBranches).toEqual([]);
  });
});
