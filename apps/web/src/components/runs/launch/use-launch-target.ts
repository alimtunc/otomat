import type { RepositoryContract } from "@otomat/domain";
import { useRepositories, useRepositoryBranches } from "@web/api/daemon/queries";
import { useState } from "react";

/** Why a project cannot be launched on, in the order the UI must resolve it. */
export type LaunchTargetBlocker =
  | "no_project"
  | "no_repository"
  | "repository_unavailable"
  | "daemon_update_pending";

export type LaunchTargetState =
  | { status: "loading" }
  | { status: "error"; error: unknown; retry: () => void }
  | { status: "blocked"; blocker: LaunchTargetBlocker }
  | {
      status: "ready";
      repository: RepositoryContract;
      /** Fork point sent as `base_branch`; defaults to the repository's own default branch. */
      baseBranch: string;
      setBaseBranch: (branch: string) => void;
      branches: string[];
      branchesPending: boolean;
      branchesFailed: boolean;
    };

/**
 * Resolves the repository a launch would run in, so the dialog can refuse
 * before creating a run instead of letting the daemon — or worse, the provider
 * — discover the project has nowhere to work.
 */
export function useLaunchTarget(projectId: string): LaunchTargetState {
  const repositories = useRepositories(projectId);
  const [override, setOverride] = useState<string | null>(null);
  const repository = repositories.data?.[0] ?? null;
  const usable = repository?.available === true ? repository : null;
  const branches = useRepositoryBranches(usable?.id ?? null);

  if (repositories.isPending) return { status: "loading" };
  if (repositories.isError) {
    return {
      status: "error",
      error: repositories.error,
      retry: () => void repositories.refetch(),
    };
  }
  if (repository === null) return { status: "blocked", blocker: "no_repository" };
  if (usable === null) return { status: "blocked", blocker: "repository_unavailable" };

  const available = branches.data?.branches ?? [];
  const fallback = branches.data?.default_branch ?? usable.default_branch;
  const picked = override !== null && available.includes(override) ? override : fallback;

  return {
    status: "ready",
    repository: usable,
    baseBranch: picked,
    setBaseBranch: setOverride,
    branches: available,
    branchesPending: branches.isPending,
    branchesFailed: branches.isError,
  };
}
