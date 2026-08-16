import type { IssueContract, OpenCycleExecution } from "@otomat/domain";
import { IssueExecutionChip } from "@web/components/issues/execution-chip";
import { Unknown } from "@web/components/issues/workspace/rail/unknown";
import type { TableCellProps } from "@web/lib/table";

export function IssueExecutionCell({
  getValue,
}: TableCellProps<IssueContract, OpenCycleExecution | null>) {
  const execution = getValue();
  return execution === null ? <Unknown /> : <IssueExecutionChip execution={execution} />;
}
