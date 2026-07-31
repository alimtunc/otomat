import type { RepositoryBranchesResponse, RepositoryContract } from "@otomat/domain";
import { vi } from "vitest";

/** A usable repository row, the shape `GET /api/repositories` returns. */
export function repository(overrides: Partial<RepositoryContract> = {}): RepositoryContract {
  return {
    id: "repo-1",
    project_id: "p1",
    name: "otomat",
    remote_url: null,
    default_branch: "main",
    available: true,
    ...overrides,
  };
}

/** What `useRepositories` resolves to in a mocked `@web/api/daemon/queries`. */
export function repositoriesQueryResult(rows: RepositoryContract[] = [repository()]) {
  return { data: rows, isPending: false, isError: false, isSuccess: true, refetch: vi.fn() };
}

/** What `useRepositoryBranches` resolves to in a mocked `@web/api/daemon/queries`. */
export function repositoryBranchesQueryResult(
  branches: RepositoryBranchesResponse = { default_branch: "main", branches: ["main", "develop"] },
) {
  return { data: branches, isPending: false, isError: false, isSuccess: true, refetch: vi.fn() };
}
