import type { IssueExecution } from "@otomat/domain";
import { IssueStatusChip } from "@otomat/ui";

/**
 * The issue's local execution state (running / reviewing / pr_open) projected
 * from persisted runs and PRs — distinct from the issue's source status. Renders
 * nothing when there is no execution evidence; callers show their own placeholder.
 */
export function IssueExecutionChip({ execution }: { execution: IssueExecution }) {
  if (execution.state === "none") return null;
  return <IssueStatusChip status={execution.state} />;
}
