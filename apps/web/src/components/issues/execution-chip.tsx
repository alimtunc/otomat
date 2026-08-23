import type { IssueExecution } from "@otomat/domain";
import { IssueStatusChip } from "@otomat/ui";

export function IssueExecutionChip({ execution }: { execution: IssueExecution }) {
  if (execution.state === "none") return null;
  return <IssueStatusChip status={execution.state} />;
}
