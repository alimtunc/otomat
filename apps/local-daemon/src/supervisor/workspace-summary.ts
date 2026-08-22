import { getRun } from "@otomat/db";
import type { WorkspaceClosureFacts } from "@otomat/domain";

import { commitsSince, diffOrNull, uncommittedPaths, worktreeGitView } from "#git";
import { findWorktreeById } from "#git/worktrees-store";

import { abandonBlocker } from "./abandon.js";
import type { SupervisorState } from "./state.js";

/** Enough history to recognize the work without turning the confirmation into a log viewer. */
const MAX_LISTED_COMMITS = 20;

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

  const { live, gitCwd, base, ref } = worktreeGitView(
    { repoRoot: binding.rootPath, defaultBranch: binding.defaultBranch },
    row,
  );
  const commits = commitsSince(gitCwd, base, ref);
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
