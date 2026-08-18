import { getPullRequestForRun, type PullRequestRow } from "@otomat/db";
import type { PublicationBlocker, PullRequestPublishability } from "@otomat/domain";

import { uncommittedPaths } from "#git";

import { GitHubCliError, GitHubPublicationError } from "../errors.js";
import type { PublicationConfig, PublicationWorkspace } from "./types.js";
import { resolveWorkspace } from "./workspace.js";

const UNRESOLVED_WORKSPACE: Omit<PullRequestPublishability, "blocker"> = {
  repository: null,
  base_ref: null,
  head_ref: null,
  changed_files: 0,
  additions: 0,
  deletions: 0,
  dirty: false,
};

function blocked(blocker: PublicationBlocker): PullRequestPublishability {
  return { ...UNRESOLVED_WORKSPACE, blocker };
}

/** Only the pull request's own settlement outranks what the workspace holds. */
function terminalBlocker(row: PullRequestRow | undefined): PublicationBlocker | null {
  if (row?.status !== "merged" && row?.status !== "closed") return null;
  return {
    code: "pr_terminal",
    message: `Pull request #${String(row.number)} is ${row.status}; it takes no further publication.`,
  };
}

/** The remote is resolved while the workspace is: only a worktree that exists can be asked where it pushes. */
function workspaceBlocker(error: unknown): PublicationBlocker {
  if (error instanceof GitHubCliError) return { code: "remote_missing", message: error.message };
  if (error instanceof GitHubPublicationError) {
    return {
      code: "worktree_missing",
      message: `${error.message} Resume the run to restore its workspace, or abandon it.`,
    };
  }
  throw error;
}

/** Answered from git and the stored publication alone, so how the run ended is never an input. */
export async function computePublishability(
  config: PublicationConfig,
  runId: string,
): Promise<PullRequestPublishability> {
  const row = getPullRequestForRun(config.db, runId);
  const terminal = terminalBlocker(row);
  if (terminal !== null) return blocked(terminal);

  let workspace: PublicationWorkspace;
  try {
    workspace = await resolveWorkspace(config, runId);
  } catch (error) {
    return blocked(workspaceBlocker(error));
  }

  const diff = workspace.worktrees.diff(runId);
  const resolved = {
    repository: workspace.remote.repository,
    base_ref: workspace.baseRef,
    head_ref: row?.head_ref ?? workspace.worktree.branch,
    changed_files: diff.files.length,
    additions: diff.files.reduce((total, file) => total + file.additions, 0),
    deletions: diff.files.reduce((total, file) => total + file.deletions, 0),
    dirty: uncommittedPaths(workspace.worktree.path).length > 0,
  };
  // An existing pull request takes updates whatever the diff now shows; only a creation needs one.
  if (row?.number !== null && row?.number !== undefined) return { ...resolved, blocker: null };
  if (diff.files.length === 0) {
    return {
      ...resolved,
      blocker: {
        code: "diff_empty",
        message: `The workspace on ${workspace.worktree.branch} carries no change against ${workspace.baseRef}, so there is nothing to open a pull request with.`,
      },
    };
  }
  return { ...resolved, blocker: null };
}
