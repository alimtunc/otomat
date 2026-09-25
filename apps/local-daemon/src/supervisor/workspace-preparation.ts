import { randomUUID } from "node:crypto";

import { getIssue, getRun, preparedWorkspace, releasePreparedWorkspace, type Db } from "@otomat/db";
import { startRunRequestSchema } from "@otomat/domain";

import { availableBranchName, inCheckout, WorktreeConflictError } from "#git";
import { validateInteractiveWorktree } from "#git/validate-worktree";
import { findWorktreeById } from "#git/worktrees-store";
import { serializeByKey } from "#serialize";

import { issueBranchName } from "./branch-name.js";
import { resolveLaunchTarget } from "./launch-target.js";
import type { SupervisorState } from "./state.js";
import { issueWorkspace } from "./workspace.js";

export function canonicalIssueWorktree(db: Db, issueId: string) {
  const workspace = issueWorkspace(db, issueId);
  if (workspace.state === "open") {
    const run = getRun(db, workspace.run_id);
    const row = run?.worktree_id ? findWorktreeById(db, run.worktree_id) : undefined;
    if (!row) throw new WorktreeConflictError("The canonical run has no available worktree.");
    return row;
  }
  return preparedWorkspace(db, issueId);
}

export async function prepareIssueWorkspace(
  state: SupervisorState,
  issueId: string,
): Promise<string> {
  const issue = getIssue(state.db, issueId);
  if (!issue) throw new WorktreeConflictError("Issue not found.");
  return serializeByKey(state.launchesByProject, issue.project_id, async () => {
    const current = getIssue(state.db, issueId);
    if (
      !current ||
      current.project_id !== issue.project_id ||
      current.status === "done" ||
      current.status === "canceled"
    ) {
      throw new WorktreeConflictError(
        "This issue is closed or has moved; refresh before opening its workspace.",
      );
    }
    let row = canonicalIssueWorktree(state.db, issueId);
    if (!row) {
      const target = await resolveLaunchTarget(
        state,
        startRunRequestSchema.parse({ issue_id: issueId }),
        current,
      );
      const owner = randomUUID();
      const branch = await availableBranchName(
        target.binding.rootPath,
        issueBranchName(current, owner),
        owner.slice(0, 8),
      );
      const created = await target.binding.service.acquire({
        owner,
        branch,
        baseRef: target.baseRef,
        baseSha: target.baseSha,
        preparedIssueId: issueId,
      });
      row = findWorktreeById(state.db, created.id);
    }
    if (!row || row.status !== "active")
      throw new WorktreeConflictError("The worktree is missing; restore it before continuing.");
    const binding = state.repositories.forProject(current.project_id);
    if (!binding || binding.repositoryId !== row.repository_id)
      throw new WorktreeConflictError("The issue's repository has changed.");
    const workspace = row;
    await inCheckout(workspace.path, () =>
      validateInteractiveWorktree(
        state.repositories.worktreesRoot,
        binding.rootPath,
        workspace.path,
        workspace.branch,
      ),
    );
    const latest = getIssue(state.db, issueId);
    if (
      !latest ||
      latest.project_id !== current.project_id ||
      latest.status === "done" ||
      latest.status === "canceled"
    ) {
      releasePreparedWorkspace(state.db, issueId);
      throw new WorktreeConflictError("The issue changed while preparing its workspace.");
    }
    return workspace.id;
  });
}
