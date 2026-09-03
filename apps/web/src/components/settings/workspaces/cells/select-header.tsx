import { Checkbox } from "@otomat/ui";
import type { HeaderContext } from "@tanstack/react-table";
import type { TABLE_FEATURES } from "@web/lib/table";
import type { WorkspaceRow } from "@web/lib/workspace/row";

export function WorkspaceSelectHeader({
  table,
}: HeaderContext<typeof TABLE_FEATURES, WorkspaceRow, unknown>) {
  if (!table.getCoreRowModel().rows.some((row) => row.getCanSelect())) return null;
  const all = table.getIsAllRowsSelected();
  return (
    <Checkbox
      checked={all}
      indeterminate={!all && table.getIsSomeRowsSelected()}
      aria-label="Select every deletable workspace"
      onCheckedChange={(checked) => table.toggleAllRowsSelected(checked === true)}
    />
  );
}
