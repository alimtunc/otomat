import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { getRun, schema, updateRunStatus } from "@otomat/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readRunEvents } from "#events";
import { createGitWorktreeService, type GitWorktreeService } from "#git";
import { createGitHubService, type GitHubService } from "#github";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { stubRepositoryResolver, type TestRepo } from "../support/git.js";
import { FakeGitHubCli, publishRequest } from "../support/github.js";
import { seedRun } from "../support/seed.js";

const RUN_ID = "r-failed";
const BRANCH = `otomat/run/${RUN_ID}`;
const READY_REQUEST = publishRequest("ship the failed run");

describe("publishing a run whose execution did not succeed", () => {
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
      runStatus: "failed",
      stepStatus: "failed",
      sessionStatus: "terminated",
    });
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

  it("reports the failed run's workspace as publishable", async () => {
    await expect(github.publishability(RUN_ID)).resolves.toMatchObject({
      blocker: null,
      repository: "acme/otomat",
      head_ref: BRANCH,
      changed_files: 1,
      dirty: true,
    });
  });

  it.each(["ready", "draft"] as const)(
    "opens a %s pull request without touching the run's status or its steps",
    async (mode) => {
      const view = await github.publish(currentRun(), { ...READY_REQUEST, mode });

      expect(view.row.publication_status).toBe("created");
      expect(view.row.number).toBe(42);
      expect(currentRun().status).toBe("failed");
      expect(
        fix.db.select().from(schema.stepRuns).where(eq(schema.stepRuns.run_id, RUN_ID)).all(),
      ).toMatchObject([{ status: "failed" }]);
      expect(cli.createInput).toMatchObject({ draft: mode === "draft" });
    },
  );

  it("journals that the publication was decided despite the failure, with the steps as they stood", async () => {
    await github.publish(currentRun(), READY_REQUEST);

    const override = readRunEvents(fix.db, RUN_ID).find(
      (event) => event.payload.published_despite_run_status !== undefined,
    );
    expect(override?.payload).toMatchObject({
      published_despite_run_status: "failed",
      steps: [{ status: "failed" }],
    });
  });

  it("blocks a workspace with no change on the exact technical reason", async () => {
    rmSync(join(worktreePath, "change.txt"));

    const publishability = await github.publishability(RUN_ID);

    expect(publishability).toMatchObject({
      blocker: { code: "diff_empty" },
    });
    expect(publishability.blocker?.message).not.toContain("Run not ready");
  });

  it("blocks a run whose workspace is gone on the exact technical reason", async () => {
    worktrees.archive(RUN_ID);

    await expect(github.publishability(RUN_ID)).resolves.toMatchObject({
      blocker: { code: "worktree_missing" },
    });
  });

  it("opens no second pull request when the publication is retried", async () => {
    await github.publish(currentRun(), READY_REQUEST);
    updateRunStatus(fix.db, RUN_ID, { status: "preparing" });

    const retried = await github.publish(currentRun(), READY_REQUEST);

    expect(retried.row.number).toBe(42);
    expect(cli.createCalls).toBe(1);
    expect(cli.pushedBranches).toEqual([BRANCH]);
  });
});
