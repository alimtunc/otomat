import { cn } from "@otomat/ui";
import { FlexRender, type Row, type RowData } from "@tanstack/react-table";
import { CELL, type TABLE_FEATURES } from "@web/lib/table";

export function TableRow<TData extends RowData>({
  row,
}: {
  row: Row<typeof TABLE_FEATURES, TData>;
}) {
  return (
    <tr className="group/row relative transition-colors hover:bg-hover">
      {row.getAllCells().map((cell) => (
        <td key={cell.id} className={cn(CELL, cell.column.columnDef.meta?.cellClassName)}>
          <FlexRender cell={cell} />
        </td>
      ))}
    </tr>
  );
}
