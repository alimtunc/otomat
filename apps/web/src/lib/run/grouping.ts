import type { IssueContract, RunContract } from "@otomat/domain";
import type { RunsViewConfig } from "@web/lib/run/view-config";

export interface RunIssueGroup {
  issueId: string;
  /** Null while the project's issues are still loading, or for a run whose issue this project no longer lists. */
  issue: IssueContract | null;
  runs: RunContract[];
}

interface VisibleRunGroups {
  groups: RunIssueGroup[];
  hiddenRuns: number;
  hiddenGroups: number;
}

function recency(group: RunIssueGroup): string {
  return group.runs[0]?.updated_at ?? "";
}

/** Groups keep the freshest run first and sort by it, so the issue worked on last leads the list. */
export function groupRunsByIssue(runs: RunContract[], issues: IssueContract[]): RunIssueGroup[] {
  const byId = new Map(issues.map((issue) => [issue.id, issue]));
  const groups = new Map<string, RunIssueGroup>();
  for (const run of runs) {
    const group = groups.get(run.issue_id) ?? {
      issueId: run.issue_id,
      issue: byId.get(run.issue_id) ?? null,
      runs: [],
    };
    group.runs.push(run);
    groups.set(run.issue_id, group);
  }
  for (const group of groups.values()) {
    group.runs.sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id));
  }
  return [...groups.values()].toSorted(
    (a, b) => recency(b).localeCompare(recency(a)) || a.issueId.localeCompare(b.issueId),
  );
}

/**
 * Filtering hides rows, never touches them: the counts say what was left out. Each axis reports
 * only its own casualties, so a group emptied by the failed filter is not also counted as hidden.
 */
export function visibleRunGroups(
  groups: RunIssueGroup[],
  config: RunsViewConfig,
): VisibleRunGroups {
  let hiddenRuns = 0;
  let hiddenGroups = 0;
  const visible: RunIssueGroup[] = [];
  for (const group of groups) {
    if (!config.showDoneIssues && group.issue?.status === "done") {
      hiddenGroups++;
      continue;
    }
    const runs = config.showFailed
      ? group.runs
      : group.runs.filter((run) => run.status !== "failed");
    hiddenRuns += group.runs.length - runs.length;
    if (runs.length > 0) visible.push({ ...group, runs });
  }
  return { groups: visible, hiddenRuns, hiddenGroups };
}
