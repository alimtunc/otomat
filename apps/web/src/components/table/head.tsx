import { cn } from "@otomat/ui";
import { FlexRender, type RowData, type Table } from "@tanstack/react-table";
import { HEAD_CELL, type TABLE_FEATURES } from "@web/lib/table";

export function TableHead<TData extends RowData>({
  table,
}: {
  table: Table<typeof TABLE_FEATURES, TData>;
}) {
  return (
    <thead>
      {table.getHeaderGroups().map((headerGroup) => (
        <tr key={headerGroup.id}>
          {headerGroup.headers.map((header) => (
            <th
              key={header.id}
              className={cn(HEAD_CELL, header.column.columnDef.meta?.headClassName)}
            >
              <FlexRender header={header} />
            </th>
          ))}
        </tr>
      ))}
    </thead>
  );
}
