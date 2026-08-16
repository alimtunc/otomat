import {
  ISSUE_BOARD_COLUMNS,
  projectIssuePrimaryState,
  type IssueBoardColumn,
  type IssueContract,
} from "@otomat/domain";
import { resolveStatus } from "@otomat/ui";
import { shortId } from "@web/lib/ids";

export const ISSUE_GROUPING_OPTIONS = [
  { value: "status", label: "Status" },
  { value: "assignee", label: "Assignee" },
  { value: "label", label: "Label" },
  { value: "project", label: "Project" },
  { value: "none", label: "No grouping" },
] as const;

export type IssueGrouping = (typeof ISSUE_GROUPING_OPTIONS)[number]["value"];

export const ISSUE_GROUPINGS: IssueGrouping[] = ISSUE_GROUPING_OPTIONS.map(
  (option) => option.value,
);

export interface IssueGroup {
  key: string;
  label: string;
  /** Status groups keep their column so a header can show the chip the board has always shown. */
  status: IssueBoardColumn | null;
  color: string | null;
  issues: IssueContract[];
}

interface GroupSeed {
  key: string;
  label: string;
  color: string | null;
}

function statusGroups(issues: IssueContract[]): IssueGroup[] {
  const byStatus = new Map<IssueBoardColumn, IssueContract[]>();
  for (const issue of issues) {
    const status = projectIssuePrimaryState(issue).state;
    const grouped = byStatus.get(status);
    if (grouped === undefined) byStatus.set(status, [issue]);
    else grouped.push(issue);
  }
  return ISSUE_BOARD_COLUMNS.flatMap((status) => {
    const grouped = byStatus.get(status);
    if (grouped === undefined) return [];
    return {
      key: `status:${status}`,
      label: resolveStatus("issue", status).label,
      status,
      color: null,
      issues: grouped,
    };
  });
}

/** An issue with several labels belongs to each of their groups; one with none falls into `fallback`, which an axis that always seeds every issue does not need. */
function collect(
  issues: IssueContract[],
  seedsFor: (issue: IssueContract) => GroupSeed[],
  fallback?: GroupSeed,
): IssueGroup[] {
  const groups = new Map<string, IssueGroup>();
  const unseeded: IssueContract[] = [];
  for (const issue of issues) {
    const seeds = seedsFor(issue);
    if (seeds.length === 0) unseeded.push(issue);
    for (const seed of seeds) {
      const group = groups.get(seed.key) ?? { ...seed, status: null, issues: [] };
      group.issues.push(issue);
      groups.set(seed.key, group);
    }
  }
  const ordered = [...groups.values()].toSorted((a, b) => a.label.localeCompare(b.label));
  if (unseeded.length === 0 || fallback === undefined) return ordered;
  return [...ordered, { ...fallback, status: null, issues: unseeded }];
}

const FALLBACK_SEEDS = {
  assignee: { key: "assignee:none", label: "Unassigned", color: null },
  label: { key: "label:none", label: "No label", color: null },
} satisfies Record<string, GroupSeed>;

function assigneeSeeds(issue: IssueContract): GroupSeed[] {
  const name = issue.source_assignee_name;
  return name === null ? [] : [{ key: `assignee:${name}`, label: name, color: null }];
}

function labelSeeds(issue: IssueContract): GroupSeed[] {
  return (issue.source_labels ?? []).map((label) => ({
    key: `label:${label.name}`,
    label: label.name,
    color: label.color,
  }));
}

function projectSeeds(issue: IssueContract, names: ReadonlyMap<string, string>): GroupSeed[] {
  return [
    {
      key: `project:${issue.project_id}`,
      label: names.get(issue.project_id) ?? shortId(issue.project_id),
      color: null,
    },
  ];
}

export function groupIssues(
  issues: IssueContract[],
  grouping: IssueGrouping,
  projectNames: ReadonlyMap<string, string>,
): IssueGroup[] {
  if (issues.length === 0) return [];
  switch (grouping) {
    case "status":
      return statusGroups(issues);
    case "assignee":
      return collect(issues, assigneeSeeds, FALLBACK_SEEDS.assignee);
    case "label":
      return collect(issues, labelSeeds, FALLBACK_SEEDS.label);
    case "project":
      return collect(issues, (issue) => projectSeeds(issue, projectNames));
    case "none":
      return [{ key: "all", label: "All issues", status: null, color: null, issues }];
  }
}
