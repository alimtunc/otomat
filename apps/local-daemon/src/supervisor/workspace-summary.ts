import { existsSync } from "node:fs";

import { getRun } from "@otomat/db";
import type { WorkspaceClosureFacts } from "@otomat/domain";

import { commitsSince, diffOrNull, uncommittedPaths, type RepositoryBinding } from "#git";
import { findWorktreeById, type WorktreeRow } from "#git/worktrees-store";

import { abandonBlocker } from "./abandon.js";
import type { SupervisorState } from "./state.js";

/** Enough history to recognize the work without turning the confirmation into a log viewer. */
const MAX_LISTED_COMMITS = 20;

/** Mirrors the diff resolution: a live worktree answers from its own HEAD, an archived one from the branch in the main repository. */
interface WorktreeGitView {
  gitCwd: string;
  base: string;
  ref: string;
}

function commitRange(row: WorktreeRow, binding: RepositoryBinding): WorktreeGitView {
  const live = row.status === "active" && existsSync(row.path);
  return {
    gitCwd: live ? row.path : binding.rootPath,
    base: row.base_sha === "" ? binding.defaultBranch : row.base_sha,
    ref: live ? "HEAD" : row.branch,
  };
}

/** What abandoning would leave behind, read from git at the moment of asking so the choice is made against the real branch. */
export function workspaceClosureFacts(
  state: SupervisorState,
  runId: string,
): WorkspaceClosureFacts | null {
  const run = getRun(state.db, runId);
  if (!run) return null;
  const blocker = abandonBlocker(state, run);
  const binding = state.repositories.forRepository(run.repository_id);
  const row = run.worktree_id === null ? undefined : findWorktreeById(state.db, run.worktree_id);
  if (!binding || !row) {
    return {
      run_id: runId,
      branch: run.branch,
      base_branch: null,
      worktree_path: null,
      commits: [],
      commit_count: 0,
      uncommitted_files: 0,
      changed_files: 0,
      additions: 0,
      deletions: 0,
      blocker,
    };
  }

  const { gitCwd, base, ref } = commitRange(row, binding);
  const commits = commitsSince(gitCwd, base, ref);
  const live = row.status === "active" && existsSync(row.path);
  const diff = diffOrNull(binding.service, runId);
  return {
    run_id: runId,
    branch: run.branch,
    base_branch: row.base_ref === "" ? null : row.base_ref,
    worktree_path: live ? row.path : null,
    commits: commits.slice(0, MAX_LISTED_COMMITS),
    commit_count: commits.length,
    uncommitted_files: live ? uncommittedPaths(row.path).length : 0,
    changed_files: diff?.files.length ?? 0,
    additions: diff?.additions ?? 0,
    deletions: diff?.deletions ?? 0,
    blocker,
  };
}
