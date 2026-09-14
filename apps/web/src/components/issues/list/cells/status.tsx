import type { IssueSummary, IssueState } from "@otomat/domain";
import { IssueStatusChip } from "@otomat/ui";
import type { TableCellProps } from "@web/lib/table";

export function IssueStatusCell({ getValue }: TableCellProps<IssueSummary, IssueState>) {
  return <IssueStatusChip status={getValue()} />;
}
