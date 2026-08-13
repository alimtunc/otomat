import {
  type CellContext,
  type CellData,
  metaHelper,
  type RowData,
  tableFeatures,
} from "@tanstack/react-table";

// border-separate (not collapse) so the sticky header keeps its bottom border while scrolling.
export const TABLE = "w-full border-separate border-spacing-0 text-sm";

export const HEAD_CELL =
  "sticky top-0 z-[2] h-7.5 border-b border-border-subtle bg-background px-3 text-left text-xs font-medium text-text-tertiary";

export const CELL = "h-10 border-b border-border-subtle px-3";

export const GROUP_HEAD_CELL = "border-b border-border-subtle bg-surface-1 p-0 text-left";

export interface TableColumnMeta {
  headClassName?: string;
  cellClassName?: string;
}

export const TABLE_FEATURES = tableFeatures({ columnMeta: metaHelper<TableColumnMeta>() });

export type TableCellProps<TData extends RowData, TValue extends CellData = CellData> = CellContext<
  typeof TABLE_FEATURES,
  TData,
  TValue
>;

/** A grouped table feeds one flat row model, so each section reads back the slice its group contributed. */
export function rowSlices<T>(rows: readonly T[], sizes: number[]): T[][] {
  let start = 0;
  return sizes.map((size) => {
    const slice = rows.slice(start, start + size);
    start += size;
    return slice;
  });
}
