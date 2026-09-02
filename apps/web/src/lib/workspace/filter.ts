import type { WorkspaceState } from "@otomat/domain";
import type { WorkspaceRow } from "@web/lib/workspace/row";

export interface WorkspacesFilter {
  search: string;
  /** Empty keeps the maintenance states, which is what hides already-cleaned history by default. */
  states: WorkspaceState[];
}

export const DEFAULT_WORKSPACES_FILTER: WorkspacesFilter = { search: "", states: [] };

function matchesSearch(row: WorkspaceRow, needle: string): boolean {
  return [
    row.host.label,
    row.repository_name,
    row.issue_identifier,
    row.issue_title,
    row.branch,
    row.path,
  ].some((field) => field !== null && field.toLowerCase().includes(needle));
}

export function filterWorkspaces(
  rows: readonly WorkspaceRow[],
  filter: WorkspacesFilter,
): WorkspaceRow[] {
  const needle = filter.search.trim().toLowerCase();
  return rows.filter((row) => {
    const state =
      filter.states.length === 0 ? row.state !== "removed" : filter.states.includes(row.state);
    return state && (needle === "" || matchesSearch(row, needle));
  });
}
