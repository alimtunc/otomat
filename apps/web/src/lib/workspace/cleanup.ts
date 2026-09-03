import { isWorkspaceCleanable, isWorkspaceForceCleanable } from "@otomat/domain";
import { plural } from "@web/lib/plural";
import type { WorkspaceRow } from "@web/lib/workspace/row";

export interface CleanupTargets {
  /** Deletable under the protective rules the daemon applies on its own. */
  ready: WorkspaceRow[];
  /** Deletable only once the operator confirms the work it discards. */
  forced: WorkspaceRow[];
  /** Nothing this surface may delete, whatever the operator confirms. */
  refused: WorkspaceRow[];
}

export function splitCleanupTargets(rows: readonly WorkspaceRow[]): CleanupTargets {
  const targets: CleanupTargets = { ready: [], forced: [], refused: [] };
  for (const row of rows) {
    if (isWorkspaceCleanable(row)) targets.ready.push(row);
    else if (isWorkspaceForceCleanable(row)) targets.forced.push(row);
    else targets.refused.push(row);
  }
  return targets;
}

/** What a forced deletion destroys, counted over its targets; `null` when it destroys nothing recorded. */
export function describeCleanupLoss(rows: readonly WorkspaceRow[]): string | null {
  const files = rows.reduce((total, row) => total + (row.uncommitted_files ?? 0), 0);
  const commits = rows.reduce((total, row) => total + (row.unpushed_commits ?? 0), 0);
  const unreadable = rows.filter((row) => row.uncommitted_files === null).length;
  const parts: string[] = [];
  if (files > 0) parts.push(plural(files, "uncommitted file"));
  if (commits > 0) parts.push(`${plural(commits, "commit")} nothing else holds`);
  if (unreadable > 0) parts.push(`${plural(unreadable, "worktree")} git could not read`);
  const last = parts.pop();
  if (last === undefined) return null;
  return parts.length === 0 ? last : `${parts.join(", ")} and ${last}`;
}
