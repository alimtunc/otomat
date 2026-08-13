import type { IssueContract, IssueExecution } from "@otomat/domain";
import { IssueExecutionChip } from "@web/components/issues/execution-chip";
import { Unknown } from "@web/components/issues/workspace/rail/unknown";
import type { TableCellProps } from "@web/lib/table";

export function IssueExecutionCell({ getValue }: TableCellProps<IssueContract, IssueExecution>) {
  const execution = getValue();
  return execution.state === "none" ? <Unknown /> : <IssueExecutionChip execution={execution} />;
}
