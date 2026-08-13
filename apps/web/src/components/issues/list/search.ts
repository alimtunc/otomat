import { LINEAR_PRIORITIES, type IssueSource } from "@otomat/domain";
import { SOURCE_OPTIONS } from "@web/components/issues/issues-filter-popover/options";
import {
  isIssuesFilter,
  type AdvancedIssueFilters,
  type IssuesFilter,
} from "@web/lib/issue/filters";

type IssuesLayout = "board" | "list";

export function isIssuesLayout(value: string): value is IssuesLayout {
  return value === "board" || value === "list";
}

/** Each field is absent at its default, so an untouched list stays on a bare `/issues`. */
export type IssuesListSearch = {
  layout?: IssuesLayout;
  filter?: IssuesFilter;
  sources?: IssueSource[];
  states?: string[];
  assignee?: string;
  priority?: number;
};

function asEntries(value: unknown): unknown[] {
  return Array.isArray(value) ? (value as unknown[]) : [];
}

function parseSources(value: unknown): IssueSource[] | undefined {
  const known: unknown[] = SOURCE_OPTIONS.map((option) => option.value);
  const selected = asEntries(value).filter((entry): entry is IssueSource => known.includes(entry));
  return selected.length > 0 ? selected : undefined;
}

function parseStates(value: unknown): string[] | undefined {
  const selected = asEntries(value).filter((entry): entry is string => typeof entry === "string");
  return selected.length > 0 ? selected : undefined;
}

function parsePriority(value: unknown): number | undefined {
  if (typeof value !== "number") return undefined;
  return LINEAR_PRIORITIES.some((priority) => priority.value === value) ? value : undefined;
}

function parseFilter(value: unknown): IssuesFilter | undefined {
  if (typeof value !== "string" || !isIssuesFilter(value) || value === "all") return undefined;
  return value;
}

export function parseIssuesListSearch(search: Record<string, unknown>): IssuesListSearch {
  const assignee = search.assignee;
  return {
    layout: search.layout === "list" ? "list" : undefined,
    filter: parseFilter(search.filter),
    sources: parseSources(search.sources),
    states: parseStates(search.states),
    assignee: typeof assignee === "string" && assignee !== "all" ? assignee : undefined,
    priority: parsePriority(search.priority),
  };
}

export function toAdvancedFilters(search: IssuesListSearch): AdvancedIssueFilters {
  return {
    sources: search.sources ?? [],
    states: search.states ?? [],
    assignee: search.assignee ?? "all",
    priority: search.priority ?? "all",
  };
}

export function fromAdvancedFilters(filters: AdvancedIssueFilters): IssuesListSearch {
  return {
    sources: filters.sources.length > 0 ? filters.sources : undefined,
    states: filters.states.length > 0 ? filters.states : undefined,
    assignee: filters.assignee === "all" ? undefined : filters.assignee,
    priority: filters.priority === "all" ? undefined : filters.priority,
  };
}
