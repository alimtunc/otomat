import { schema, type Db } from "@otomat/db";
import type { WorktreeStatus } from "@otomat/domain";
import { and, eq, inArray, isNull } from "drizzle-orm";

const { issues, pullRequests, runs, stepRuns, worktrees } = schema;

export interface WorkspaceRecord {
  worktree_id: string;
  path: string;
  branch: string;
  status: WorktreeStatus;
  head_sha: string | null;
  updated_at: string;
  run_id: string | null;
  issue_id: string | null;
  issue_identifier: string | null;
  issue_title: string | null;
  pull_request: { number: number | null; url: string | null; merged: boolean } | null;
}

/** A worktree is held either by a step or by the run itself, so both kinds resolve to one run. */
interface PullRequestEvidenceIndex {
  byRun: Map<string, WorkspacePullRequest>;
  byBranch: Map<string, WorkspacePullRequest>;
}

function owningRuns(db: Db, worktreeIds: string[]): Map<string, string> {
  const owners = new Map<string, string>();
  const candidates = db
    .select({ run_id: stepRuns.run_id, worktree_id: stepRuns.worktree_id })
    .from(stepRuns)
    .where(inArray(stepRuns.worktree_id, worktreeIds))
    .all();
  for (const row of candidates) {
    if (row.worktree_id !== null) owners.set(row.worktree_id, row.run_id);
  }
  const canonical = db
    .select({ run_id: runs.id, worktree_id: runs.worktree_id })
    .from(runs)
    .where(inArray(runs.worktree_id, worktreeIds))
    .all();
  for (const row of canonical) {
    if (row.worktree_id !== null) owners.set(row.worktree_id, row.run_id);
  }
  return owners;
}

interface RunContext {
  issue_id: string;
  issue_identifier: string | null;
  issue_title: string;
}

function runContexts(db: Db, runIds: string[]): Map<string, RunContext> {
  if (runIds.length === 0) return new Map();
  const rows = db
    .select({
      run_id: runs.id,
      issue_id: issues.id,
      issue_identifier: issues.source_identifier,
      issue_title: issues.title,
    })
    .from(runs)
    .innerJoin(issues, eq(runs.issue_id, issues.id))
    .where(inArray(runs.id, runIds))
    .all();
  return new Map(
    rows.map((row) => [
      row.run_id,
      {
        issue_id: row.issue_id,
        issue_identifier: row.issue_identifier,
        issue_title: row.issue_title,
      },
    ]),
  );
}

type WorkspacePullRequest = NonNullable<WorkspaceRecord["pull_request"]>;

/** A merge is only ever read from a row naming this workspace, never from the issue at large. */
function pullRequestsByBranch(db: Db, runIds: string[]): PullRequestEvidenceIndex {
  const byRun = new Map<string, WorkspacePullRequest>();
  const byBranch = new Map<string, WorkspacePullRequest>();
  if (runIds.length === 0) return { byRun, byBranch };
  const issueIds = db
    .selectDistinct({ issue_id: runs.issue_id })
    .from(runs)
    .where(inArray(runs.id, runIds))
    .all()
    .map((row) => row.issue_id);
  const rows = db
    .select()
    .from(pullRequests)
    .where(and(inArray(pullRequests.issue_id, issueIds), isNull(pullRequests.detached_at)))
    .all();
  for (const row of rows) {
    const value = { number: row.number, url: row.url, merged: row.status === "merged" };
    if (row.run_id !== null && (value.merged || !byRun.has(row.run_id))) {
      byRun.set(row.run_id, value);
    }
    if (row.head_ref === null) continue;
    const key = `${row.issue_id}\u0000${row.head_ref}`;
    if (value.merged || !byBranch.has(key)) byBranch.set(key, value);
  }
  return { byRun, byBranch };
}

function standingPullRequest(
  onRun: WorkspacePullRequest | undefined,
  onBranch: WorkspacePullRequest | undefined,
): WorkspacePullRequest | null {
  if (onRun?.merged === true) return onRun;
  if (onBranch?.merged === true) return onBranch;
  return onRun ?? onBranch ?? null;
}

export function listWorkspaceRecords(db: Db, repositoryId: string): WorkspaceRecord[] {
  const rows = db.select().from(worktrees).where(eq(worktrees.repository_id, repositoryId)).all();
  if (rows.length === 0) return [];

  const owners = owningRuns(
    db,
    rows.map((row) => row.id),
  );
  const runIds = [...new Set(owners.values())];
  const contexts = runContexts(db, runIds);
  const { byRun, byBranch } = pullRequestsByBranch(db, runIds);
  return rows.map((row) => {
    const runId = owners.get(row.id) ?? null;
    const context = runId === null ? undefined : contexts.get(runId);
    const onRun = runId === null ? undefined : byRun.get(runId);
    const onBranch =
      context === undefined ? undefined : byBranch.get(`${context.issue_id}\u0000${row.branch}`);
    return {
      worktree_id: row.id,
      path: row.path,
      branch: row.branch,
      status: row.status,
      head_sha: row.head_sha,
      updated_at: row.updated_at,
      run_id: runId,
      issue_id: context?.issue_id ?? null,
      issue_identifier: context?.issue_identifier ?? null,
      issue_title: context?.issue_title ?? null,
      pull_request: standingPullRequest(onRun, onBranch),
    };
  });
}
