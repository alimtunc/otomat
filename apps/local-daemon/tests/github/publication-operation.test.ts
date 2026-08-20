import { mkdirSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";

import {
  getPullRequestForRun,
  getRun,
  updatePullRequest,
  writePullRequestGenerator,
  type PullRequestRow,
  type RunRow,
} from "@otomat/db";
import {
  projectPullRequestPublicationOperation,
  PUBLICATION_INTERRUPTED_CODE,
  PULL_REQUEST_PUBLICATION_ACTIVE_STATES,
  type PullRequestProposal,
} from "@otomat/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readRunEvents } from "#events";
import { createGitWorktreeService, type GitWorktreeService } from "#git";
import { createGitHubService, type GitHubService, type GitHubServiceConfig } from "#github";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { stubRepositoryResolver } from "../support/git.js";
import { FakeGitHubCli, publishRequest } from "../support/github.js";
import { seedRun } from "../support/seed.js";

const RUN_ID = "r-operation";
const BRANCH = `otomat/run/${RUN_ID}`;

function operationOf(row: PullRequestRow) {
  return projectPullRequestPublicationOperation(row.id, {
    ...row,
    updated_at: "2026-08-20T09:00:00.000Z",
  });
}

const PROPOSAL: PullRequestProposal = {
  subject: { type: "feat", scope: "pr", summary: "publish in one action" },
  body: "Publishes the run in one click.",
  branch: "feat/compact-pr",
  commit_body: null,
  generator: { runtime: "claude", model: "claude-opus-5", effort: "high" },
};

/** Holds the push open so the answer to the caller can be observed before the work is done. */
class HeldPushCli extends FakeGitHubCli {
  private release: (() => void) | null = null;
  readonly held = new Promise<void>((resolve) => {
    this.release = resolve;
  });

  override async push(cwd: string, remote: string, branch: string): Promise<void> {
    await this.held;
    await super.push(cwd, remote, branch);
  }

  resume(): void {
    this.release?.();
  }
}

describe("pull request publication as a durable operation", () => {
  let fix: DaemonTestDb;
  let worktrees: GitWorktreeService;
  let cli: FakeGitHubCli;

  beforeEach(() => {
    fix = setupDaemonDb();
    worktrees = createGitWorktreeService({
      db: fix.db,
      repositoryId: "repo-1",
      repoRoot: fix.repo.root,
      defaultBranch: fix.repo.defaultBranch,
      worktreesRoot: join(fix.dataDir, "worktrees"),
    });
    const acquired = worktrees.acquire({ owner: RUN_ID, branch: BRANCH });
    seedRun(fix.db, {
      runId: RUN_ID,
      worktreeId: acquired.id,
      runStatus: "review_ready",
      stepStatus: "succeeded",
      sessionStatus: "terminated",
    });
    writeFileSync(join(acquired.path, "change.txt"), "first\n");
    cli = new FakeGitHubCli();
    cli.provider = { ...cli.provider, headRef: BRANCH };
  });

  afterEach(() => {
    fix.cleanup();
  });

  function run(): RunRow {
    const row = getRun(fix.db, RUN_ID);
    if (!row) throw new Error("seeded run missing");
    return row;
  }

  function stored(): PullRequestRow {
    const row = getPullRequestForRun(fix.db, RUN_ID);
    if (!row) throw new Error("no pull request was recorded");
    return row;
  }

  function service(generator?: GitHubServiceConfig["generator"]): GitHubService {
    const config: GitHubServiceConfig = {
      db: fix.db,
      dataDir: fix.dataDir,
      repositories: stubRepositoryResolver(worktrees, {
        repositoryId: fix.repositoryId,
        rootPath: fix.repo.root,
        worktreesRoot: join(fix.dataDir, "worktrees"),
      }),
      cli,
      idFactory: () => "pr-operation-1",
    };
    if (generator) config.generator = generator;
    return createGitHubService(config);
  }

  /** Puts a runtime on PATH so agent resolution stops gating what this suite is really asserting. */
  function withStubbedClaude(assertion: () => Promise<void>): Promise<void> {
    const binDir = join(fix.dataDir, "runtime-bin");
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(binDir, "claude"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    writePullRequestGenerator(fix.db, { runtime: "claude", model: null, options: {} });
    const restore = process.env.PATH;
    process.env.PATH = `${binDir}${delimiter}${restore ?? ""}`;
    return assertion().finally(() => {
      process.env.PATH = restore;
    });
  }

  it("answers with the accepted operation and finishes the work after the caller is gone", async () => {
    const held = new HeldPushCli();
    held.provider = { ...held.provider, headRef: BRANCH };
    cli = held;
    const github = service();

    const accepted = await github.publish(run(), publishRequest("ship it"));

    expect(accepted.row.publication_status).toBe("committing");
    expect(operationOf(accepted.row)).toMatchObject({ state: "running", retryable: false });
    expect(held.pushCalls).toBe(0);

    held.resume();
    await github.settlePublications();

    expect(operationOf(stored())).toMatchObject({ state: "succeeded", error: null });
    expect(stored()).toMatchObject({ publication_status: "created", number: 42 });
  });

  it("writes the metadata and publishes it as one operation the client never drives", async () => {
    let generations = 0;
    await withStubbedClaude(async () => {
      const github = service({
        generate: async () => {
          generations += 1;
          return PROPOSAL;
        },
      });

      const accepted = await github.publish(run(), { mode: "ready" });
      expect(accepted.row.publication_status).toBe("generating");

      cli.provider = { ...cli.provider, headRef: PROPOSAL.branch };
      await github.settlePublications();
    });

    expect(generations).toBe(1);
    expect(stored()).toMatchObject({
      publication_status: "created",
      commit_subject: "feat(pr): publish in one action",
      head_ref: PROPOSAL.branch,
    });
    expect(cli.pushedBranches).toEqual([PROPOSAL.branch]);
    const phases = readRunEvents(fix.db, RUN_ID).map(
      (event) => event.payload["publication_status"],
    );
    expect(phases.filter((phase, index) => phase !== phases[index - 1])).toEqual([
      "generating",
      "committing",
      "pushing",
      "creating",
      "created",
    ]);
  });

  it.each(PULL_REQUEST_PUBLICATION_ACTIVE_STATES)(
    "classifies a publication a stopped daemon left in %s as interrupted at that phase",
    async (phase) => {
      const github = service();
      await github.publish(run(), publishRequest("ship it"));
      await github.settlePublications();
      updatePullRequest(fix.db, stored().id, { publication_status: phase, failed_phase: null });

      expect(service().reconcileInterruptedPublications()).toBe(1);

      expect(stored()).toMatchObject({
        publication_status: "failed",
        failed_phase: phase,
        error_code: PUBLICATION_INTERRUPTED_CODE,
      });
      expect(operationOf(stored())).toMatchObject({ state: "interrupted", retryable: true });
      expect(operationOf(stored())?.phases.find((entry) => entry.state === "failed")).toBeDefined();
    },
  );

  it.each(PULL_REQUEST_PUBLICATION_ACTIVE_STATES)(
    "retries a publication interrupted in %s without opening a second pull request",
    async (phase) => {
      const first = service();
      await first.publish(run(), publishRequest("ship it"));
      await first.settlePublications();
      expect(cli.createCalls).toBe(1);
      updatePullRequest(fix.db, stored().id, { publication_status: phase });

      const restarted = service();
      restarted.reconcileInterruptedPublications();
      await restarted.publish(run(), publishRequest("ship it"));
      await restarted.settlePublications();

      expect(stored()).toMatchObject({
        publication_status: "created",
        number: 42,
        error_code: null,
      });
      expect(cli.createCalls).toBe(1);
      expect(new Set(cli.pushedBranches)).toEqual(new Set([BRANCH]));
    },
  );

  it("keeps the update of an existing pull request running until GitHub answered", async () => {
    const github = service();
    await github.publish(run(), publishRequest("ship it"));
    await github.settlePublications();
    const observed: string[] = [];
    const update = cli.updatePullRequest.bind(cli);
    cli.updatePullRequest = async (input) => {
      observed.push(stored().publication_status);
      await update(input);
    };

    await github.publish(run(), publishRequest("ship it harder"));
    await github.settlePublications();

    expect(observed).toEqual(["creating"]);
    expect(operationOf(stored())).toMatchObject({ state: "succeeded", error: null });
  });

  it("opens no operation on a pull request that is already settled", async () => {
    const github = service();
    await github.publish(run(), publishRequest("ship it"));
    await github.settlePublications();
    updatePullRequest(fix.db, stored().id, { status: "merged" });

    const accepted = await github.publish(run(), publishRequest("ship it again"));
    await github.settlePublications();

    expect(accepted.row.publication_status).toBe("created");
    expect(operationOf(stored())).toMatchObject({ state: "succeeded" });
    expect(cli.createCalls).toBe(1);
  });

  it("leaves a publication running in this process alone", async () => {
    const held = new HeldPushCli();
    held.provider = { ...held.provider, headRef: BRANCH };
    cli = held;
    const github = service();
    await github.publish(run(), publishRequest("ship it"));

    expect(github.reconcileInterruptedPublications()).toBe(0);

    held.resume();
    await github.settlePublications();
    expect(stored().publication_status).toBe("created");
  });
});
