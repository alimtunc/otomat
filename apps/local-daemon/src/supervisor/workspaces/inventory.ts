import { existsSync } from "node:fs";

import {
  getRun,
  listAgentSessionsForRun,
  listIssueExecutionEvidence,
  listRepositories,
  type Db,
  type RepositoryRow,
} from "@otomat/db";
import {
  agentSessionMachine,
  countWorkspaces,
  describeWorkspace,
  projectIssueWorkspace,
  projectWorkspaceState,
  type WorkspaceEntry,
  type WorkspaceInventory,
} from "@otomat/domain";

import { isRepositoryRoot, uncommittedPaths, type RepositoryBinding } from "#git";
import { listWorktrees } from "#git/worktree-cli";

import { isProcessAlive } from "../process.js";
import type { WorkspaceScope } from "../types.js";
import { attachWorkspaces, type AttachedWorkspace } from "./attach.js";
import type { WorkspaceContext } from "./context.js";
import { listWorkspaceRecords } from "./evidence.js";

function writerAlive(context: WorkspaceContext, runId: string | null): boolean {
  if (runId === null) return false;
  if (context.busyRuns(runId)) return true;
  return listAgentSessionsForRun(context.db, runId).some(
    (session) =>
      !agentSessionMachine.isTerminal(session.status) &&
      session.pid !== null &&
      isProcessAlive(session.pid),
  );
}

/** `null` says the worktree refused to answer, which blocks a deletion instead of allowing one. */
function readDirty(path: string): boolean | null {
  try {
    return uncommittedPaths(path).length > 0;
  } catch (error) {
    console.error(`[otomat] git status for worktree ${path} failed`, error);
    return null;
  }
}

function toEntry(
  context: WorkspaceContext,
  repository: RepositoryRow,
  binding: RepositoryBinding,
  attached: AttachedWorkspace,
  holders: Map<string, string>,
): WorkspaceEntry {
  const { record } = attached;
  const present = existsSync(attached.path);
  const dirty = present ? readDirty(attached.path) : false;
  const issueId = record?.issue_id ?? null;
  const verdict = projectWorkspaceState({
    attachment: attached.attachment,
    registered: attached.registered,
    present,
    record_status: record?.status ?? null,
    cycle_open: issueId !== null && holders.get(issueId) === record?.run_id,
    dirty,
    writer_alive: writerAlive(context, record?.run_id ?? null),
  });
  return {
    id: record?.worktree_id ?? attached.path,
    repository_id: repository.id,
    repository_name: repository.name,
    repository_path: binding.rootPath,
    issue_id: issueId,
    issue_identifier: record?.issue_identifier ?? null,
    issue_title: record?.issue_title ?? null,
    run_id: record?.run_id ?? null,
    branch: attached.branch,
    path: attached.path,
    state: verdict.state,
    attachment: attached.attachment,
    blocker: verdict.blocker,
    reason: describeWorkspace(verdict, attached.attachment),
    registered: attached.registered,
    present,
    dirty,
    head_sha: attached.head,
    last_activity_at: record?.updated_at ?? null,
    pull_request: record?.pull_request ?? null,
  };
}

/** Read once per inventory so classifying a worktree never queries the cycle again. */
export function cycleHolders(db: Db): Map<string, string> {
  const byIssue = new Map<string, ReturnType<typeof listIssueExecutionEvidence>>();
  for (const row of listIssueExecutionEvidence(db)) {
    const rows = byIssue.get(row.issue_id) ?? [];
    rows.push(row);
    byIssue.set(row.issue_id, rows);
  }
  const holders = new Map<string, string>();
  for (const [issueId, rows] of byIssue) {
    const workspace = projectIssueWorkspace(rows);
    if (workspace.state === "open") holders.set(issueId, workspace.run_id);
  }
  return holders;
}

export function repositoryInventory(
  context: WorkspaceContext,
  repository: RepositoryRow,
  holders: Map<string, string>,
): WorkspaceEntry[] {
  const binding = context.repositories.forRepository(repository.id);
  // A root that is no longer a repository would converge its rows over an unmounted checkout.
  if (!binding || !isRepositoryRoot(binding.rootPath)) return [];
  const attached = attachWorkspaces(
    listWorktrees(binding.rootPath),
    listWorkspaceRecords(context.db, repository.id),
    { repoRoot: binding.rootPath, worktreesRoot: context.repositories.worktreesRoot },
  );
  return attached.map((entry) => toEntry(context, repository, binding, entry, holders));
}

export function listWorkspaces(
  context: WorkspaceContext,
  scope: WorkspaceScope = {},
): WorkspaceInventory {
  const run = scope.runId === undefined ? undefined : getRun(context.db, scope.runId);
  const holders = cycleHolders(context.db);
  const entries = listRepositories(context.db, { projectId: scope.projectId })
    .filter((repository) => run === undefined || repository.id === run.repository_id)
    .flatMap((repository) => repositoryInventory(context, repository, holders));
  const scoped =
    scope.runId === undefined ? entries : entries.filter((entry) => entry.run_id === scope.runId);
  return { entries: scoped, counts: countWorkspaces(scoped) };
}
