import { Checkbox } from "@otomat/ui";
import type { TableCellProps } from "@web/lib/table";
import type { WorkspaceRow } from "@web/lib/workspace/row";

export function WorkspaceSelectCell({ row }: TableCellProps<WorkspaceRow, unknown>) {
  if (!row.getCanSelect()) return null;
  return (
    <Checkbox
      checked={row.getIsSelected()}
      aria-label={`Select ${row.original.branch ?? row.original.path}`}
      onCheckedChange={(checked) => row.toggleSelected(checked === true)}
    />
  );
}
