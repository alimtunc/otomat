import { getProject, listRepositories, type Db, type IssueRow } from "@otomat/db";
import type { RunLaunchError, StartRunRequest } from "@otomat/domain";

import { branchExists, isRepositoryRoot, type RepositoryBinding } from "#git";

import type { SupervisorState } from "./state.js";

/** A launch refused before any row is written, carrying the wire code the API returns verbatim. */
export class LaunchRefusedError extends Error {
  constructor(
    readonly code: RunLaunchError,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "LaunchRefusedError";
  }
}

/** Where a run executes: the project that owns it, its repository, and the ref its worktree forks from. */
export interface LaunchTarget {
  projectId: string;
  binding: RepositoryBinding;
  baseRef: string;
}

/**
 * The issue owns the project, so an issue-based launch always runs in that
 * project's repository. An explicit `project_id` that disagrees is refused
 * rather than silently dropped: the caller asked for a repository it would not
 * have got.
 */
function resolveProjectId(
  db: Db,
  defaultProjectId: string,
  request: StartRunRequest,
  issue: IssueRow | undefined,
): string {
  if (issue) {
    if (request.project_id && request.project_id !== issue.project_id) {
      throw new LaunchRefusedError(
        "project_mismatch",
        `issue ${issue.id} belongs to project ${issue.project_id}, not ${request.project_id}`,
      );
    }
    return issue.project_id;
  }
  if (!request.project_id) return defaultProjectId;
  if (!getProject(db, request.project_id)) {
    throw new LaunchRefusedError("project_not_found", `project ${request.project_id} not found`);
  }
  return request.project_id;
}

/** Distinguishes "this project never had a repository" from "its repository is no longer on disk". */
function requireBinding(state: SupervisorState, projectId: string): RepositoryBinding {
  const binding = state.repositories.forProject(projectId);
  if (!binding) {
    const registered = listRepositories(state.db, { projectId }).length > 0;
    throw registered
      ? new LaunchRefusedError(
          "repository_unavailable",
          `project ${projectId} has a repository the daemon cannot use`,
        )
      : new LaunchRefusedError(
          "repository_required",
          `project ${projectId} has no repository to run in`,
        );
  }
  if (!isRepositoryRoot(binding.rootPath)) {
    throw new LaunchRefusedError(
      "repository_unavailable",
      `${binding.rootPath} is no longer a git repository; re-register it to launch here`,
    );
  }
  return binding;
}

/** Every refusal is a typed `LaunchRefusedError` thrown before the launch writes any row. */
export function resolveLaunchTarget(
  state: SupervisorState,
  request: StartRunRequest,
  issue: IssueRow | undefined,
): LaunchTarget {
  const projectId = resolveProjectId(state.db, state.defaultProjectId, request, issue);
  const binding = requireBinding(state, projectId);
  const baseRef = request.base_branch ?? binding.defaultBranch;
  if (!branchExists(binding.rootPath, baseRef)) {
    throw new LaunchRefusedError(
      "base_branch_not_found",
      `branch "${baseRef}" does not exist in ${binding.rootPath}`,
    );
  }
  return { projectId, binding, baseRef };
}
