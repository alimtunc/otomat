import { join } from "node:path";

import { getIssue, getPullRequest, getRun, insertPullRequest } from "@otomat/db";
import { afterEach, expect, it, vi } from "vitest";

import { createRepositoryResolver } from "#git";
import {
  createGitHubCli,
  createGitHubService,
  type CommandRequest,
  type CommandResult,
} from "#github";
import { setupDaemonDb, type DaemonTestDb } from "#test-support/daemon-db";
import { FakeGitHubCli, providerPullRequest } from "#test-support/github";
import { seedRun } from "#test-support/seed";

const TARGET = { cwd: "/repo", repository: "acme/app", number: 42 };

function member(number: number, head: string, base: string) {
  return {
    number,
    title: `PR ${number}`,
    html_url: `https://github.com/acme/app/pull/${number}`,
    state: "open",
    draft: false,
    merged_at: null,
    head: { ref: head },
    base: { ref: base },
  };
}

it("reads GitHub's declared order and member states with GET only", async () => {
  const requests: CommandRequest[] = [];
  const responses = [
    [{ number: 7 }],
    {
      number: 7,
      base: { ref: "main" },
      pull_requests: [
        { ...member(41, "types", "main"), state: "closed", merged_at: "2026-09-26T00:00:00Z" },
        member(42, "api", "types"),
        { ...member(43, "ui", "api"), draft: true },
      ],
    },
  ];
  const cli = createGitHubCli(async (request) => {
    requests.push(request);
    return { exitCode: 0, stderr: "", stdout: JSON.stringify(responses.shift()) };
  });
  const stack = await cli.readPullRequestStack(TARGET);
  expect(stack?.members.map((item) => [item.number, item.status])).toEqual([
    [41, "merged"],
    [42, "open"],
    [43, "draft"],
  ]);
  expect(requests[0]?.args).toContain("repos/acme/app/stacks?pull_request=42&per_page=2");
  expect(requests.every((request) => request.args.includes("GET"))).toBe(true);
});

it("accepts a successful empty list but never treats an API refusal as no stack", async () => {
  let response: CommandResult = { exitCode: 0, stderr: "", stdout: "[]" };
  const cli = createGitHubCli(async () => response);
  await expect(cli.readPullRequestStack(TARGET)).resolves.toBeNull();
  response = { exitCode: 1, stderr: "HTTP 404", stdout: "" };
  await expect(cli.readPullRequestStack(TARGET)).rejects.toMatchObject({
    code: "github_stack_unavailable",
  });
});

it.each([
  { members: [member(42, "api", "types"), member(42, "duplicate", "api")] },
  { members: [member(41, "types", "main")] },
])("rejects duplicate members and a stack that lost the requested PR", async ({ members }) => {
  const responses = [[{ number: 7 }], { number: 7, base: { ref: "main" }, pull_requests: members }];
  const cli = createGitHubCli(async () => ({
    exitCode: 0,
    stderr: "",
    stdout: JSON.stringify(responses.shift()),
  }));
  await expect(cli.readPullRequestStack(TARGET)).rejects.toMatchObject({
    code: "github_stack_invalid",
  });
});

let fixture: DaemonTestDb | undefined;
afterEach(() => fixture?.cleanup());

it("reading a merged intermediate PR neither reconciles its mirror nor closes its issue or run", async () => {
  const t = setupDaemonDb();
  fixture = t;
  seedRun(t.db, {
    runId: "run",
    runStatus: "review_ready",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
  });
  insertPullRequest(t.db, {
    id: "pr",
    issue_id: "i1",
    run_id: "run",
    repository_id: t.repositoryId,
    number: 42,
    provider: "github",
    title: "API",
    status: "open",
    publication_status: "created",
    head_ref: "api",
    base_ref: "types",
  });
  const cli = new FakeGitHubCli();
  cli.provider = providerPullRequest({
    number: 42,
    lifecycle: "merged",
    headRef: "api",
    baseRef: "types",
  });
  const lifecycle = vi.fn();
  const service = createGitHubService({
    db: t.db,
    dataDir: t.dataDir,
    cli,
    syncIssueLifecycle: lifecycle,
    repositories: createRepositoryResolver({
      db: t.db,
      worktreesRoot: join(t.dataDir, "worktrees"),
    }),
  });
  const before = [getIssue(t.db, "i1"), getRun(t.db, "run"), getPullRequest(t.db, "pr")];
  const writes = t.client.sqlite.prepare("SELECT total_changes() AS count").get();
  expect(await service.pullRequestStack("pr")).toMatchObject({
    stack: null,
    current: { status: "merged", head_ref: "api", base_ref: "types" },
  });
  expect([getIssue(t.db, "i1"), getRun(t.db, "run"), getPullRequest(t.db, "pr")]).toEqual(before);
  expect(t.client.sqlite.prepare("SELECT total_changes() AS count").get()).toEqual(writes);
  expect(lifecycle).not.toHaveBeenCalled();
});
