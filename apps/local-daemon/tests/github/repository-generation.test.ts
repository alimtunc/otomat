import { join } from "node:path";

import { listRuns, writePullRequestGenerator } from "@otomat/db";
import type { PullRequestProposal } from "@otomat/domain";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { createRepositoryResolver, sourceControlSnapshot } from "#git";
import { createGitHubService, createPullRequestGenerator, type GitHubService } from "#github";
import type { PullRequestGenerator } from "#github/types";
import { setupDaemonDb, type DaemonTestDb } from "#test-support/daemon-db";
import { FakeGitHubCli } from "#test-support/github";
import { stubRuntimeOnPath } from "#test-support/runtime";

const PROPOSAL: PullRequestProposal = {
  subject: { type: "feat", scope: "files", summary: "describe project commits" },
  body: "Project changes.",
  branch: "feat/project-changes",
  commit_body: null,
  generator: { runtime: "claude", model: null, effort: null },
};

let fix: DaemonTestDb;
let cli: FakeGitHubCli;
let github: GitHubService;
let generate: ReturnType<typeof vi.fn<PullRequestGenerator["generate"]>>;
let restorePath: () => void;

beforeEach(() => {
  fix = setupDaemonDb();
  fix.repo.write("manual.txt", "committed\n");
  fix.repo.commitAll("feat: project changes");
  restorePath = stubRuntimeOnPath(fix.dataDir, "claude");
  writePullRequestGenerator(fix.db, { runtime: "claude", model: null, options: {} });
  cli = new FakeGitHubCli();
  vi.spyOn(cli, "fetchBranch").mockImplementation(async () => {
    fix.repo.git("fetch", "origin", "main");
  });
  generate = vi.fn<PullRequestGenerator["generate"]>(async () => PROPOSAL);
  github = createGitHubService({
    db: fix.db,
    dataDir: fix.dataDir,
    cli,
    generator: { generate },
    repositories: createRepositoryResolver({
      db: fix.db,
      worktreesRoot: join(fix.dataDir, "worktrees"),
    }),
  });
});
afterEach(() => {
  restorePath();
  fix.cleanup();
});

function request() {
  return { revision: sourceControlSnapshot(fix.repo.root).response.revision, base_ref: "main" };
}

it("previews and generates committed changes without creating a branch, run, commit or PR", async () => {
  fix.repo.write("manual.txt", "unstaged secret\n");
  const head = fix.repo.git("rev-parse", "HEAD");
  const preview = await github.previewRepositoryPullRequest(fix.repositoryId, "main");
  expect(preview.publishability).toMatchObject({ changed_files: 1, dirty: false, blocker: null });
  expect(cli.fetchBranch).not.toHaveBeenCalled();
  expect(generate).not.toHaveBeenCalled();
  expect(await github.generateRepositoryPullRequest(fix.repositoryId, request())).toEqual(PROPOSAL);
  expect(generate).toHaveBeenCalledWith(
    expect.objectContaining({ audit: expect.objectContaining({ runtime: "claude" }) }),
    expect.objectContaining({ issue: null, patch: expect.stringContaining("+committed") }),
  );
  expect(generate.mock.calls[0]?.[1].patch).not.toContain("unstaged secret");
  expect(fix.repo.git("rev-parse", "HEAD")).toBe(head);
  expect(fix.repo.git("branch", "--show-current").trim()).toBe("main");
  expect(cli.pushCalls).toBe(0);
  expect(cli.createCalls).toBe(0);
  expect(listRuns(fix.db)).toEqual([]);
});

it("generates and publishes in the chosen mode using the configured generator", async () => {
  const row = await github.publishRepositoryPullRequest(fix.repositoryId, {
    ...request(),
    mode: "ready",
  });
  expect(generate).toHaveBeenCalledOnce();
  expect(cli.createInput).toMatchObject({
    title: "feat(files): describe project commits",
    body: PROPOSAL.body,
    head: PROPOSAL.branch,
    draft: false,
  });
  expect(row).toMatchObject({
    run_id: null,
    issue_id: null,
    generator_runtime: "claude",
    commit_subject: "feat(files): describe project commits",
  });
});

it("refuses a changed checkout after generation before pushing or creating a branch", async () => {
  generate.mockImplementationOnce(async () => {
    fix.repo.write("manual.txt", "changed\n");
    return PROPOSAL;
  });
  await expect(
    github.publishRepositoryPullRequest(fix.repositoryId, { ...request(), mode: "draft" }),
  ).rejects.toThrow("checkout changed during generation");
  expect(cli.pushCalls).toBe(0);
  expect(cli.createCalls).toBe(0);
  expect(fix.repo.git("branch", "--show-current").trim()).toBe("main");
});

it("requires a configured generator when no run supplies a runtime", async () => {
  writePullRequestGenerator(fix.db, { runtime: null, model: null, options: {} });
  await expect(
    github.generateRepositoryPullRequest(fix.repositoryId, request()),
  ).rejects.toMatchObject({ code: "pr_generator_not_configured" });
  expect(generate).not.toHaveBeenCalled();
  expect(cli.pushCalls).toBe(0);
});

it("uses the shared generation format without inventing an issue reference", async () => {
  const run = vi.fn(async () => ({
    stdout:
      '<otomat-json>{"type":"feat","scope":"files","summary":"describe project commits","body":"Project changes.","branch":"feat/project-changes","delivery":"complete"}</otomat-json>',
    stderr: "",
    exitCode: 0,
  }));
  const generator = createPullRequestGenerator(run);
  const result = await generator.generate(
    { command: "claude", args: [], effort: null, audit: PROPOSAL.generator },
    { cwd: fix.repo.root, issue: null, diffStat: ["manual.txt +1 -0"], patch: "+committed" },
  );
  expect(result.body).toBe("Project changes.");
  expect(run).toHaveBeenCalledWith(
    expect.objectContaining({ stdin: expect.stringContaining("no issue is attached") }),
  );
});
