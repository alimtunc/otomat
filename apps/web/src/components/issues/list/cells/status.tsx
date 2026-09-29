import type { IssueSummary, IssueState } from "@otomat/domain";
import { IssueStatusChip } from "@otomat/ui";
import { waitSupersedesRunning } from "@web/lib/issue/divergent-status";
import type { TableCellProps } from "@web/lib/table";

export function IssueStatusCell({ row, getValue }: TableCellProps<IssueSummary, IssueState>) {
  if (waitSupersedesRunning(row.original)) return null;
  return <IssueStatusChip status={getValue()} />;
}
