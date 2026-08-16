import { ISSUE_BOARD_COLUMNS, type IssueBoardColumn, type IssueSource } from "@otomat/domain";
import { asMember, asString, normalizedMembers, normalizedSelection } from "@web/lib/coerce";
import { ISSUE_SOURCES, knownPriority } from "@web/lib/issue/filter-options";
import { ISSUE_GROUPINGS, type IssueGrouping } from "@web/lib/issue/grouping";
import { ISSUE_SORTS, type IssueSort } from "@web/lib/issue/sort";
import type { IssuesViewConfig } from "@web/lib/issue/view-config";

/** `[]` and `all` are values, not absence: an emptied axis still travels. */
export interface IssuesListSearch {
  view?: string;
  group?: IssueGrouping;
  sort?: IssueSort;
  sources?: IssueSource[];
  statuses?: IssueBoardColumn[];
  linearStates?: string[];
  labels?: string[];
  projects?: string[];
  assignee?: string;
  priority?: number | "all";
  collapsed?: string[];
}

function selection(value: unknown): string[] | undefined {
  return Array.isArray(value) ? normalizedSelection(value) : undefined;
}

function members<T extends string>(value: unknown, allowed: readonly T[]): T[] | undefined {
  return Array.isArray(value) ? normalizedMembers(value, allowed) : undefined;
}

function parsePriority(value: unknown): number | "all" | undefined {
  if (value === "all") return "all";
  return knownPriority(value) ?? undefined;
}

export function parseIssuesListSearch(search: Record<string, unknown>): IssuesListSearch {
  return {
    view: asString(search.view) ?? undefined,
    group: asMember(search.group, ISSUE_GROUPINGS) ?? undefined,
    sort: asMember(search.sort, ISSUE_SORTS) ?? undefined,
    sources: members(search.sources, ISSUE_SOURCES),
    statuses: members(search.statuses, ISSUE_BOARD_COLUMNS),
    linearStates: selection(search.linearStates),
    labels: selection(search.labels),
    projects: selection(search.projects),
    assignee: asString(search.assignee) ?? undefined,
    priority: parsePriority(search.priority),
    collapsed: selection(search.collapsed),
  };
}

export function issuesConfigFromSearch(
  view: IssuesViewConfig,
  search: IssuesListSearch,
): IssuesViewConfig {
  return {
    grouping: search.group ?? view.grouping,
    sort: search.sort ?? view.sort,
    advanced: {
      sources: search.sources ?? view.advanced.sources,
      statuses: search.statuses ?? view.advanced.statuses,
      linearStates: search.linearStates ?? view.advanced.linearStates,
      labels: search.labels ?? view.advanced.labels,
      projects: search.projects ?? view.advanced.projects,
      assignee: search.assignee ?? view.advanced.assignee,
      priority: search.priority ?? view.advanced.priority,
    },
    collapsedGroups: search.collapsed ?? view.collapsedGroups,
  };
}

function sameSelection(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((entry, index) => entry === b[index]);
}

export function issuesSearchFromConfig(
  view: IssuesViewConfig,
  config: IssuesViewConfig,
): IssuesListSearch {
  const next = config.advanced;
  const base = view.advanced;
  return {
    group: config.grouping === view.grouping ? undefined : config.grouping,
    sort: config.sort === view.sort ? undefined : config.sort,
    sources: sameSelection(next.sources, base.sources) ? undefined : next.sources,
    statuses: sameSelection(next.statuses, base.statuses) ? undefined : next.statuses,
    linearStates: sameSelection(next.linearStates, base.linearStates)
      ? undefined
      : next.linearStates,
    labels: sameSelection(next.labels, base.labels) ? undefined : next.labels,
    projects: sameSelection(next.projects, base.projects) ? undefined : next.projects,
    assignee: next.assignee === base.assignee ? undefined : next.assignee,
    priority: next.priority === base.priority ? undefined : next.priority,
    collapsed: sameSelection(config.collapsedGroups, view.collapsedGroups)
      ? undefined
      : config.collapsedGroups,
  };
}

export function hasOverrides(search: IssuesListSearch): boolean {
  return Object.values(search).some((value) => value !== undefined);
}
