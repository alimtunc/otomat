import type { WorkspaceEntry } from "@otomat/domain";

export function workspaceEntry(over: Partial<WorkspaceEntry> & { id: string }): WorkspaceEntry {
  return {
    repository_id: "repo-1",
    repository_name: "otomat",
    repository_path: "/tmp/otomat",
    issue_id: "i1",
    issue_identifier: "OTO-88",
    issue_title: "Reconcile worktrees",
    run_id: "r1",
    branch: `otomat/run/${over.id}`,
    path: `/tmp/worktrees/${over.id}`,
    state: "cleanup_required",
    provenance: "otomat_run",
    blocker: null,
    reason: "Ready to delete: the cycle is closed and the worktree is clean.",
    registered: true,
    present: true,
    uncommitted_files: 0,
    unpushed_commits: 0,
    head_sha: null,
    last_activity_at: null,
    pull_request: null,
    ...over,
  };
}
