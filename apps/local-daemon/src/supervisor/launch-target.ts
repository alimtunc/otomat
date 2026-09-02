import { getProject, listRepositories, type Db, type IssueRow } from "@otomat/db";
import type { RunLaunchError, StartRunRequest } from "@otomat/domain";

import {
  branchExists,
  isRepositoryRoot,
  RemoteBaseError,
  resolveBaseSha,
  type RepositoryBinding,
} from "#git";

import type { SupervisorState } from "./state.js";
import { issueWorkspace } from "./workspace.js";

/** A launch refused before any row is written, carrying the wire code the API returns verbatim. */
export class LaunchRefusedError extends Error {
  /** The run the caller should act on instead; set only when the refusal names one. */
  readonly runId: string | null;

  constructor(
    readonly code: RunLaunchError,
    message: string,
    options?: ErrorOptions & { runId?: string },
  ) {
    super(message, options);
    this.name = "LaunchRefusedError";
    this.runId = options?.runId ?? null;
  }
}

/** Where a run executes: the project that owns it, its repository, and the ref its worktree forks from. */
export interface LaunchTarget {
  projectId: string;
  binding: RepositoryBinding;
  baseRef: string;
  baseSha: string;
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

/**
 * An issue keeps one canonical workspace until its work is merged or abandoned,
 * so a second launch would fork a competing worktree off the same issue. The
 * caller is sent to the run that holds it, where a step can be appended instead.
 */
function refuseSecondWorkspace(state: SupervisorState, issue: IssueRow): void {
  const workspace = issueWorkspace(state.db, issue.id);
  if (workspace.state !== "open") return;
  throw new LaunchRefusedError(
    "issue_workspace_open",
    `issue ${issue.id} already works in ${workspace.branch}; add a step to that run instead of starting a second workspace`,
    { runId: workspace.run_id },
  );
}

function launchBaseSha(rootPath: string, baseRef: string, request: StartRunRequest): string {
  try {
    return resolveBaseSha(rootPath, baseRef, request.local_base === true);
  } catch (error) {
    if (!(error instanceof RemoteBaseError)) throw error;
    throw new LaunchRefusedError("base_remote_unavailable", error.message, { cause: error });
  }
}

/** Every refusal is a typed `LaunchRefusedError` thrown before the launch writes any row. */
export function resolveLaunchTarget(
  state: SupervisorState,
  request: StartRunRequest,
  issue: IssueRow | undefined,
): LaunchTarget {
  if (issue) refuseSecondWorkspace(state, issue);
  const projectId = resolveProjectId(state.db, state.defaultProjectId, request, issue);
  const binding = requireBinding(state, projectId);
  const baseRef = request.base_branch ?? binding.defaultBranch;
  if (!branchExists(binding.rootPath, baseRef)) {
    throw new LaunchRefusedError(
      "base_branch_not_found",
      `branch "${baseRef}" does not exist in ${binding.rootPath}`,
    );
  }
  return {
    projectId,
    binding,
    baseRef,
    baseSha: launchBaseSha(binding.rootPath, baseRef, request),
  };
}
