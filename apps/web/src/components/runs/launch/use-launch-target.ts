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
      status: "ambiguous";
      repositories: RepositoryContract[];
      choose: (repositoryId: string) => void;
    }
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

export type ReadyLaunchTarget = Extract<LaunchTargetState, { status: "ready" }>;

/**
 * Resolves the repository a launch would run in, so the dialog can refuse
 * before creating a run instead of letting the daemon — or worse, the provider
 * — discover the project has nowhere to work. Several usable repositories are
 * `ambiguous` rather than silently the first one: which worktree the agent gets
 * is not a detail Otomat may pick.
 */
export function useLaunchTarget(projectId: string): LaunchTargetState {
  const repositories = useRepositories(projectId);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [branchOverride, setBranchOverride] = useState<string | null>(null);
  const known = repositories.data ?? [];
  const usable = known.filter((entry) => entry.available);
  const chosen = usable.find((entry) => entry.id === chosenId) ?? null;
  const resolved = chosen ?? (usable.length === 1 ? (usable[0] ?? null) : null);
  const branches = useRepositoryBranches(resolved?.id ?? null);

  if (repositories.isPending) return { status: "loading" };
  if (repositories.isError) {
    return {
      status: "error",
      error: repositories.error,
      retry: () => void repositories.refetch(),
    };
  }
  if (known.length === 0) return { status: "blocked", blocker: "no_repository" };
  if (usable.length === 0) return { status: "blocked", blocker: "repository_unavailable" };
  if (resolved === null) {
    return { status: "ambiguous", repositories: usable, choose: setChosenId };
  }

  const available = branches.data?.branches ?? [];
  const fallback = branches.data?.default_branch ?? resolved.default_branch;
  const picked =
    branchOverride !== null && available.includes(branchOverride) ? branchOverride : fallback;

  return {
    status: "ready",
    repository: resolved,
    baseBranch: picked,
    setBaseBranch: setBranchOverride,
    branches: available,
    branchesPending: branches.isPending,
    branchesFailed: branches.isError,
  };
}
