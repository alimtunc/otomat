import { isWorkspaceForceCleanable } from "@otomat/domain";
import { cn } from "@otomat/ui";
import { useTable, type RowSelectionState } from "@tanstack/react-table";
import { WORKSPACE_COLUMNS } from "@web/components/settings/workspaces/columns";
import { TableHead } from "@web/components/table/head";
import { TableRow } from "@web/components/table/row";
import { TABLE, TABLE_FEATURES } from "@web/lib/table";
import type { WorkspaceRow } from "@web/lib/workspace/row";
import type { Dispatch, SetStateAction } from "react";

export interface WorkspacesTableProps {
  rows: WorkspaceRow[];
  selection: RowSelectionState;
  onSelectionChange: Dispatch<SetStateAction<RowSelectionState>>;
}

export function WorkspacesTable({ rows, selection, onSelectionChange }: WorkspacesTableProps) {
  const table = useTable({
    features: TABLE_FEATURES,
    columns: WORKSPACE_COLUMNS,
    data: rows,
    getRowId: (row) => row.id,
    enableRowSelection: (row) => isWorkspaceForceCleanable(row.original),
    state: { rowSelection: selection },
    onRowSelectionChange: onSelectionChange,
  });

  return (
    <div className="overflow-auto">
      {/* Fixed layout: a nowrap branch or path would otherwise widen the table past its pane. */}
      <table className={cn(TABLE, "table-fixed")}>
        <TableHead table={table} />
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
