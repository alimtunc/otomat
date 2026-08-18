import type { WorkspaceEntry, WorkspaceState } from "@otomat/domain";

export interface WorkspacesFilter {
  search: string;
  /** Empty keeps the maintenance states, which is what hides already-cleaned history by default. */
  states: WorkspaceState[];
}

export const DEFAULT_WORKSPACES_FILTER: WorkspacesFilter = { search: "", states: [] };

function matchesSearch(entry: WorkspaceEntry, needle: string): boolean {
  return [
    entry.repository_name,
    entry.issue_identifier,
    entry.issue_title,
    entry.branch,
    entry.path,
  ].some((field) => field !== null && field.toLowerCase().includes(needle));
}

export function filterWorkspaces(
  entries: readonly WorkspaceEntry[],
  filter: WorkspacesFilter,
): WorkspaceEntry[] {
  const needle = filter.search.trim().toLowerCase();
  return entries.filter((entry) => {
    const state =
      filter.states.length === 0 ? entry.state !== "removed" : filter.states.includes(entry.state);
    return state && (needle === "" || matchesSearch(entry, needle));
  });
}

export interface WorkspaceRepositoryGroup {
  repositoryId: string;
  name: string;
  path: string;
  entries: WorkspaceEntry[];
}

export function groupWorkspacesByRepository(
  entries: readonly WorkspaceEntry[],
): WorkspaceRepositoryGroup[] {
  const groups = new Map<string, WorkspaceRepositoryGroup>();
  for (const entry of entries) {
    const group = groups.get(entry.repository_id) ?? {
      repositoryId: entry.repository_id,
      name: entry.repository_name,
      path: entry.repository_path,
      entries: [],
    };
    group.entries.push(entry);
    groups.set(entry.repository_id, group);
  }
  return [...groups.values()];
}
