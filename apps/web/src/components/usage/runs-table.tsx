import type { UsageRunRow } from "@otomat/domain";
import { useTable } from "@tanstack/react-table";
import { TableHead } from "@web/components/table/head";
import { TableRow } from "@web/components/table/row";
import { USAGE_RUN_COLUMNS } from "@web/components/usage/columns";
import { TABLE, TABLE_FEATURES } from "@web/lib/table";

export interface UsageRunsTableProps {
  rows: UsageRunRow[];
  total: number;
}

export function UsageRunsTable({ rows, total }: UsageRunsTableProps) {
  const table = useTable({ features: TABLE_FEATURES, columns: USAGE_RUN_COLUMNS, data: rows });

  return (
    <>
      <table className={TABLE}>
        <TableHead table={table} />
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} row={row} />
          ))}
        </tbody>
      </table>
      {rows.length < total ? (
        <p className="px-4.5 py-2 text-xs text-text-tertiary">
          Showing the {rows.length} most recent of {total} runs in this window.
        </p>
      ) : null}
    </>
  );
}
