import type { RepositoryBranchesResponse, RepositoryContract } from "@otomat/domain";
import type { ReadyLaunchTarget } from "@web/components/runs/launch/use-launch-target";
import { vi } from "vitest";

export function repository(overrides: Partial<RepositoryContract> = {}): RepositoryContract {
  return {
    id: "repo-1",
    project_id: "p1",
    name: "otomat",
    remote_url: null,
    default_branch: "main",
    init_commands: [],
    available: true,
    ...overrides,
  };
}

export function readyLaunchTarget(): ReadyLaunchTarget {
  return {
    status: "ready",
    repository: repository(),
    baseBranch: "main",
    setBaseBranch: vi.fn(),
    branches: ["main", "develop"],
    branchesPending: false,
    branchesFailed: false,
  };
}

export function repositoriesQueryResult(rows: RepositoryContract[] = [repository()]) {
  return { data: rows, isPending: false, isError: false, isSuccess: true, refetch: vi.fn() };
}

export function repositoryBranchesQueryResult(
  branches: RepositoryBranchesResponse = { default_branch: "main", branches: ["main", "develop"] },
) {
  return { data: branches, isPending: false, isError: false, isSuccess: true, refetch: vi.fn() };
}

export function repositoryBranchesErrorResult() {
  return {
    data: undefined,
    isPending: false,
    isError: true,
    isSuccess: false,
    refetch: vi.fn(),
  };
}
