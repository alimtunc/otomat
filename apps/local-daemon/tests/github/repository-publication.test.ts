import { readFileSync } from "node:fs";
import { join } from "node:path";

import { listRuns } from "@otomat/db";
import type { PublishRepositoryPullRequest } from "@otomat/domain";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { createRepositoryResolver, sourceControlSnapshot } from "#git";
import { runGit } from "#git/git-cli";
import { createGitHubService, GitHubCliError, type GitHubService } from "#github";
import { setupDaemonDb, type DaemonTestDb } from "#test-support/daemon-db";
import { FakeGitHubCli } from "#test-support/github";

let fix: DaemonTestDb;
let cli: FakeGitHubCli;
let github: GitHubService;

beforeEach(() => {
  fix = setupDaemonDb();
  fix.repo.write("manual.txt", "committed\n");
  fix.repo.commitAll("feat: manual changes");
  cli = new FakeGitHubCli();
  vi.spyOn(cli, "fetchBranch").mockImplementation(async () => {
    fix.repo.git("fetch", "origin", "main");
  });
  vi.spyOn(cli, "push").mockImplementation(async (cwd, remote, branch, sha) => {
    if (cli.pushError !== null) throw cli.pushError;
    runGit(["push", remote, `${sha}:refs/heads/${branch}`], { cwd });
    cli.pushedBranches.push(branch);
    cli.remoteHeads.set(branch, sha ?? "");
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
afterEach(() => fix.cleanup());

function request(
  overrides: Partial<PublishRepositoryPullRequest> = {},
  headRef = "feat/manual-pr",
): PublishRepositoryPullRequest {
  return {
    revision: sourceControlSnapshot(fix.repo.root).response.revision,
    base_ref: "main",
    mode: "draft",
    details: {
      subject: { type: "feat", scope: null, summary: "manual changes" },
      body: "Reviewed changes",
      head_ref: headRef,
    },
    ...overrides,
  };
}

it(
  "publishes a dedicated branch from main, preserves uncommitted work and creates no run",
  { timeout: 20_000 },
  async () => {
    fix.repo.write("manual.txt", "uncommitted\n");
    const remoteMain = fix.repo.git("rev-parse", "origin/main");
    const head = fix.repo.git("rev-parse", "HEAD").trim();
    const result = await github.publishRepositoryPullRequest(fix.repositoryId, request());
    expect(result).toMatchObject({
      run_id: null,
      issue_id: null,
      repository_id: fix.repositoryId,
      number: 42,
      status: "draft",
    });
    expect(cli.createInput).toMatchObject({
      head: "feat/manual-pr",
      base: "main",
      title: "feat: manual changes",
      draft: true,
    });
    expect(cli.push).toHaveBeenCalledWith(fix.repo.root, "origin", "feat/manual-pr", head);
    expect(fix.repo.git("rev-parse", "origin/main")).toBe(remoteMain);
    expect(fix.repo.git("rev-parse", "--abbrev-ref", "HEAD").trim()).toBe("feat/manual-pr");
    expect(readFileSync(join(fix.repo.root, "manual.txt"), "utf8")).toBe("uncommitted\n");
    expect(listRuns(fix.db)).toEqual([]);
    const retried = await github.publishRepositoryPullRequest(fix.repositoryId, request());
    expect(retried.id).toBe(result.id);
    expect(cli.createCalls).toBe(1);
  },
);

it(
  "refuses default/base branches, stale revisions and uncommitted staged changes before pushing",
  { timeout: 20_000 },
  async () => {
    for (const head_ref of ["main", "master", "HEAD", "-bad", "bad..branch"])
      await expect(
        github.publishRepositoryPullRequest(fix.repositoryId, request({}, head_ref)),
      ).rejects.toThrow();
    const stale = request();
    fix.repo.write("new.txt", "new\n");
    await expect(github.publishRepositoryPullRequest(fix.repositoryId, stale)).rejects.toThrow(
      "checkout changed",
    );
    fix.repo.git("add", "new.txt");
    await expect(github.publishRepositoryPullRequest(fix.repositoryId, request())).rejects.toThrow(
      "Commit the staged changes",
    );
    expect(cli.push).not.toHaveBeenCalled();
    expect(fix.repo.git("rev-parse", "--abbrev-ref", "HEAD").trim()).toBe("main");
  },
);

it("refuses changes made during the remote preparation", async () => {
  vi.spyOn(cli, "resolveRemote").mockImplementation(async () => {
    fix.repo.write("manual.txt", "changed while preparing\n");
    return cli.remote;
  });
  await expect(github.publishRepositoryPullRequest(fix.repositoryId, request())).rejects.toThrow(
    "checkout changed during preparation",
  );
  expect(cli.push).not.toHaveBeenCalled();
});

it(
  "does not overwrite an existing branch or publish an empty diff",
  { timeout: 20_000 },
  async () => {
    fix.repo.git("branch", "feat/manual-pr");
    await expect(github.publishRepositoryPullRequest(fix.repositoryId, request())).rejects.toThrow(
      "already exists",
    );
    cli.remoteHeads.set("feat/taken", "a".repeat(40));
    await expect(
      github.publishRepositoryPullRequest(fix.repositoryId, request({}, "feat/taken")),
    ).rejects.toThrow("remote branch already exists");
    fix.repo.git("push", "origin", "main");
    await expect(
      github.publishRepositoryPullRequest(fix.repositoryId, request({}, "feat/empty")),
    ).rejects.toThrow("No committed changes");
    expect(cli.push).not.toHaveBeenCalled();
  },
);

it("keeps the new local branch and reports a push failure, then retries safely", async () => {
  cli.pushError = new GitHubCliError("github_push_failed", "network unavailable");
  await expect(github.publishRepositoryPullRequest(fix.repositoryId, request())).rejects.toThrow(
    "network unavailable",
  );
  expect(cli.createCalls).toBe(0);
  expect(fix.repo.git("rev-parse", "--abbrev-ref", "HEAD").trim()).toBe("feat/manual-pr");
  cli.pushError = null;
  await expect(
    github.publishRepositoryPullRequest(fix.repositoryId, request()),
  ).resolves.toMatchObject({
    number: 42,
  });
});
