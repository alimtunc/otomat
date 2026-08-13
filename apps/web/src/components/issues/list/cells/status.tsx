import type { IssueContract, IssueState } from "@otomat/domain";
import { IssueStatusChip } from "@otomat/ui";
import type { TableCellProps } from "@web/lib/table";

export function IssueStatusCell({ getValue }: TableCellProps<IssueContract, IssueState>) {
  return <IssueStatusChip status={getValue()} />;
}
