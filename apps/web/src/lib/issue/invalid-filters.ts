import type { IssueFilterOption, IssueFilterOptions } from "@web/lib/issue/filter-options";
import type { AdvancedIssueFilters } from "@web/lib/issue/filters";

function values(options: IssueFilterOption[]): ReadonlySet<string> {
  return new Set(options.map((option) => option.value));
}

/** A filter on a renamed label would otherwise empty the list without saying why. */
export function unmatchedFilterValues(
  filters: AdvancedIssueFilters,
  options: IssueFilterOptions,
): string[] {
  // Every issue carries a project, so an empty project axis means nothing has loaded yet.
  if (options.projects.length === 0) return [];

  const unmatched: string[] = [];
  const check = (axis: string, selected: string[], present: ReadonlySet<string>): void => {
    for (const value of selected) {
      if (!present.has(value)) unmatched.push(`${axis} ${value}`);
    }
  };
  check("Label", filters.labels, values(options.labels));
  check("State", filters.linearStates, values(options.linearStates));
  check("Project", filters.projects, values(options.projects));
  if (filters.assignee !== "all" && filters.assignee !== "unassigned") {
    check("Assignee", [filters.assignee], values(options.assignees));
  }
  return unmatched;
}
