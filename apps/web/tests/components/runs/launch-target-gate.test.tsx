// @vitest-environment happy-dom
import type { IssueContract, RepositoryContract } from "@otomat/domain";
import { LaunchTargetGate } from "@web/components/runs/launch/launch-target-gate";
import { afterEach, expect, it, vi } from "vitest";

import {
  repositoriesQueryResult,
  repository,
  repositoryBranchesQueryResult,
} from "#support/launch-target";
import { mount } from "#support/mount";

let repositories: RepositoryContract[] = [repository()];
let repositoriesFailed = false;
const moveIssue = vi.fn();

// Mirrors the daemon: `projectId` scopes the list, no argument returns every repository.
vi.mock("@web/api/daemon/queries", () => ({
  useRepositories: (projectId?: string) =>
    repositoriesFailed
      ? { data: undefined, isPending: false, isError: true, isSuccess: false, refetch: vi.fn() }
      : repositoriesQueryResult(
          projectId === undefined
            ? repositories
            : repositories.filter((row) => row.project_id === projectId),
        ),
  useRepositoryBranches: () => repositoryBranchesQueryResult(),
  useProjects: () => ({ data: [], isPending: false, isError: false, isSuccess: true }),
}));

vi.mock("@web/api/repositories/mutations", () => ({
  useRegisterRepository: () => ({ mutateAsync: vi.fn(), isPending: false }),
  registerRepositoryErrorMessage: () => "nope",
}));

vi.mock("@web/api/issues/mutations", () => ({
  useMoveIssueProject: () => ({ mutate: moveIssue, isPending: false, isError: false, error: null }),
  moveIssueProjectErrorMessage: () => "nope",
}));

const ISSUE: IssueContract = {
  id: "issue-1",
  project_id: "p1",
  title: "Ship the CSV parser",
  body: null,
  status: "ready",
  execution: { state: "none", run_id: null },
  source: "local",
  source_external_id: null,
  source_identifier: null,
  source_url: null,
  synced_at: null,
  source_assignee_name: null,
  source_priority: null,
  source_labels: null,
  source_state_name: null,
  source_state_color: null,
};

const cleanups: Array<() => Promise<void>> = [];
const launchable = vi.fn();

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  repositories = [repository()];
  repositoriesFailed = false;
  launchable.mockClear();
  moveIssue.mockClear();
});

async function renderGate(projectId: string | undefined, issue?: IssueContract) {
  const mounted = await mount(
    <LaunchTargetGate projectId={projectId} issue={issue}>
      {(target) => {
        launchable(target);
        return <button type="button">Launch run</button>;
      }}
    </LaunchTargetGate>,
  );
  cleanups.push(mounted.cleanup);
}

it("renders the launch form with the resolved repository and base branch", async () => {
  await renderGate("p1", ISSUE);

  expect(launchable).toHaveBeenCalledWith(
    expect.objectContaining({ status: "ready", baseBranch: "main" }),
  );
  expect(document.body.textContent).toContain("Launch run");
});

it("blocks before any launch control exists when the project has no repository", async () => {
  repositories = [];
  await renderGate("p1", ISSUE);

  expect(launchable).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("This project has no repository");
  expect(document.body.textContent).not.toContain("Launch run");
});

it("blocks when the project's repository is no longer usable on disk", async () => {
  repositories = [repository({ available: false })];
  await renderGate("p1", ISSUE);

  expect(launchable).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("repository is unavailable");
});

it("offers registering a repository for the blocked project", async () => {
  repositories = [];
  await renderGate("p1", ISSUE);

  expect(document.querySelector("input[aria-label='Repository path']")).not.toBeNull();
});

it("offers moving a local issue to another project that is ready", async () => {
  repositories = [repository({ id: "r-other", project_id: "p-other", name: "other-repo" })];
  await renderGate("p1", ISSUE);

  expect(launchable).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("Run this issue in another project");
});

it("does not offer moving a mirrored issue, whose project belongs to its tracker", async () => {
  repositories = [repository({ id: "r-other", project_id: "p-other", name: "other-repo" })];
  await renderGate("p1", {
    ...ISSUE,
    source: "linear",
    source_external_id: "lin-1",
    source_identifier: "OTO-1",
    synced_at: "2026-07-29T00:00:00.000Z",
  });

  expect(document.body.textContent).not.toContain("Run this issue in another project");
  expect(document.body.textContent).toContain("stays in its synced project");
});

it("blocks with no repository form when no project is selected at all", async () => {
  await renderGate(undefined);

  expect(launchable).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("No project selected");
  expect(document.querySelector("input[aria-label='Repository path']")).toBeNull();
});

it("surfaces a retryable error instead of silently allowing a launch", async () => {
  repositoriesFailed = true;
  await renderGate("p1", ISSUE);

  expect(launchable).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("Couldn’t load this project’s repository");
});
