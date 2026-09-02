import { cn } from "@otomat/ui";
import { useTable } from "@tanstack/react-table";
import { WORKSPACE_COLUMNS } from "@web/components/settings/workspaces/columns";
import { TableHead } from "@web/components/table/head";
import { TableRow } from "@web/components/table/row";
import { TABLE, TABLE_FEATURES } from "@web/lib/table";
import type { WorkspaceRow } from "@web/lib/workspace/row";

export function WorkspacesTable({ rows }: { rows: WorkspaceRow[] }) {
  const table = useTable({ features: TABLE_FEATURES, columns: WORKSPACE_COLUMNS, data: rows });

  return (
    // Fixed layout: a nowrap branch or path would otherwise widen the table past its pane.
    <table className={cn(TABLE, "table-fixed")}>
      <TableHead table={table} />
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id} row={row} />
        ))}
      </tbody>
    </table>
  );
}
