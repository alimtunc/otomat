import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { getRun, schema } from "@otomat/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createGitWorktreeService, type GitWorktreeService } from "#git";
import { createGitHubService, type GitHubService } from "#github";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { stubRepositoryResolver, type TestRepo } from "../support/git.js";
import { FakeGitHubCli, publishRequest } from "../support/github.js";
import { seedRun } from "../support/seed.js";

const RUN_ID = "r-commit";
const BRANCH = `otomat/run/${RUN_ID}`;
const REQUEST = publishRequest("publish in one action", {
  subject: { type: "feat", scope: "pr", summary: "publish in one action" },
});

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

    expect(lastMessage()).not.toContain("chore(worktree): snapshot");
  });

  it("composes the subject and the title from one object, and links the issue in a footer", async () => {
    const view = await github.publish(currentRun(), REQUEST);

    expect(lastMessage()).toBe("feat(pr): publish in one action\n\nRefs OTO-81");
    expect(cli.createInput?.title).toBe("feat(pr): publish in one action (OTO-81)");
    expect(view.row.commit_subject).toBe("feat(pr): publish in one action");
  });

  it("commits a scopeless subject as the operator wrote it", async () => {
    await github.publish(
      currentRun(),
      publishRequest("publish in one action", {
        subject: { type: "chore", scope: null, summary: "publish in one action" },
      }),
    );

    expect(lastMessage()).toBe("chore: publish in one action\n\nRefs OTO-81");
  });

  it("commits without a footer when the issue carries no identifier", async () => {
    fix.db
      .update(schema.issues)
      .set({ source_identifier: null })
      .where(eq(schema.issues.id, "i1"))
      .run();

    await github.publish(currentRun(), REQUEST);

    expect(lastMessage()).toBe("feat(pr): publish in one action");
    expect(cli.createInput?.title).toBe("feat(pr): publish in one action");
  });

  it("commits the edited subject rather than the one a generation had proposed", async () => {
    fix.db
      .insert(schema.pullRequests)
      .values({
        id: "pr-local-1",
        run_id: RUN_ID,
        title: "feat(publication): compose the commit (OTO-81)",
        commit_subject: "feat(publication): compose the commit",
        commit_body: "The generator wrote this paragraph.",
      })
      .run();

    await github.publish(currentRun(), REQUEST);

    expect(lastMessage()).toBe(
      "feat(pr): publish in one action\n\nThe generator wrote this paragraph.\n\nRefs OTO-81",
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

  it("keeps the published commit and the pull request title in step", async () => {
    await github.publish(currentRun(), REQUEST);

    expect(cli.createInput?.title).toBe(`${lastMessage().split("\n")[0] ?? ""} (OTO-81)`);
    expect(cli.pushedBranches).toEqual([BRANCH]);
  });
});
