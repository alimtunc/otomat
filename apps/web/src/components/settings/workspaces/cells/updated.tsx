import { RelativeTime } from "@otomat/ui";
import type { TableCellProps } from "@web/lib/table";
import type { WorkspaceRow } from "@web/lib/workspace/row";

export function WorkspaceUpdatedCell({ row }: TableCellProps<WorkspaceRow, unknown>) {
  const lastActivity = row.original.last_activity_at;
  if (lastActivity === null) return <span className="text-text-tertiary">—</span>;
  return (
    <span className="whitespace-nowrap">
      <RelativeTime date={lastActivity} addSuffix={false} />
    </span>
  );
}
