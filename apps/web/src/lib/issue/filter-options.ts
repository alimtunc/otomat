import {
  ISSUE_BOARD_COLUMNS,
  LINEAR_PRIORITIES,
  type IssueContract,
  type IssueSource,
} from "@otomat/domain";
import { resolveStatus } from "@otomat/ui";
import { asNumber } from "@web/lib/coerce";
import { shortId } from "@web/lib/ids";

export interface IssueFilterOption {
  value: string;
  label: string;
  color?: string;
}

export interface IssueFilterOptions {
  assignees: IssueFilterOption[];
  linearStates: IssueFilterOption[];
  labels: IssueFilterOption[];
  projects: IssueFilterOption[];
}

export const ISSUE_SOURCE_OPTIONS: { value: IssueSource; label: string }[] = [
  { value: "linear", label: "Linear" },
  { value: "github", label: "GitHub" },
  { value: "local", label: "Local" },
];

export const ISSUE_SOURCES: IssueSource[] = ISSUE_SOURCE_OPTIONS.map((option) => option.value);

export const ISSUE_STATUS_OPTIONS = ISSUE_BOARD_COLUMNS.map((status) => ({
  value: status,
  label: resolveStatus("issue", status).label,
}));

export const PRIORITY_OPTIONS = [
  { value: "all", label: "Any priority" },
  ...LINEAR_PRIORITIES.map((priority) => ({
    value: String(priority.value),
    label: priority.label,
  })),
];

export function knownPriority(value: unknown): number | null {
  const priority = asNumber(value);
  return LINEAR_PRIORITIES.some((option) => option.value === priority) ? priority : null;
}

function sortedOptions(values: Map<string, IssueFilterOption>): IssueFilterOption[] {
  return [...values.values()].toSorted((a, b) => a.label.localeCompare(b.label));
}

export function assigneeOptions(issues: IssueContract[]): IssueFilterOption[] {
  const names = new Map<string, IssueFilterOption>();
  for (const issue of issues) {
    const name = issue.source_assignee_name;
    if (name !== null) names.set(name, { value: name, label: name });
  }
  return sortedOptions(names);
}

export function linearStateOptions(issues: IssueContract[]): IssueFilterOption[] {
  const states = new Map<string, IssueFilterOption>();
  for (const issue of issues) {
    const name = issue.source_state_name;
    if (name !== null && !states.has(name)) {
      states.set(name, {
        value: name,
        label: name,
        color: issue.source_state_color ?? "var(--text-tertiary)",
      });
    }
  }
  return sortedOptions(states);
}

export function labelOptions(issues: IssueContract[]): IssueFilterOption[] {
  const labels = new Map<string, IssueFilterOption>();
  for (const issue of issues) {
    for (const label of issue.source_labels ?? []) {
      if (!labels.has(label.name)) {
        labels.set(label.name, { value: label.name, label: label.name, color: label.color });
      }
    }
  }
  return sortedOptions(labels);
}

export function projectOptions(
  issues: IssueContract[],
  names: ReadonlyMap<string, string>,
): IssueFilterOption[] {
  const projects = new Map<string, IssueFilterOption>();
  for (const issue of issues) {
    projects.set(issue.project_id, {
      value: issue.project_id,
      label: names.get(issue.project_id) ?? shortId(issue.project_id),
    });
  }
  return sortedOptions(projects);
}
