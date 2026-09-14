import type { Row, RowData, Table } from "@tanstack/react-table";
import { TableHead } from "@web/components/table/head";
import { TableRow } from "@web/components/table/row";
import { useVirtualList } from "@web/components/virtual-list/use-virtual-list";
import { GROUP_HEAD_CELL, TABLE, type TABLE_FEATURES } from "@web/lib/table";
import { Fragment, useMemo, type ReactNode } from "react";

export function VirtualTable<T extends RowData>({
  table,
  groups,
  columnCount,
  scrollId,
}: {
  table: Table<typeof TABLE_FEATURES, T>;
  groups: { key: string; header?: ReactNode; rows: Row<typeof TABLE_FEATURES, T>[] }[];
  columnCount: number;
  scrollId: string;
}) {
  const entries = useMemo(
    () =>
      groups.flatMap((group) => [
        ...(group.header ? [{ key: `${group.key}:header`, header: group.header, row: null }] : []),
        ...group.rows.map((row) => ({ key: `${group.key}:${row.id}`, header: null, row })),
      ]),
    [groups],
  );
  const { virtualizer, containerProps } = useVirtualList({
    id: scrollId,
    count: entries.length,
    getItemKey: (index) => entries[index].key,
    estimateSize: (index) => (entries[index].row === null ? 36 : 40),
    paddingStart: 30,
  });
  const items = virtualizer.getVirtualItems();
  return (
    <div {...containerProps} className="h-full min-h-0 overflow-auto">
      <table className={`${TABLE} table-fixed`} aria-rowcount={entries.length + 1}>
        <TableHead table={table} />
        <tbody>
          {items.map((item, position) => {
            const entry = entries[item.index];
            const gap = item.start - (items[position - 1]?.end ?? 30);
            const rowProps = {
              "data-index": item.index,
              "data-virtual-index": item.index,
              "aria-rowindex": item.index + 2,
              ref: virtualizer.measureElement,
            };
            return (
              <Fragment key={item.key}>
                {gap > 0 ? (
                  <tr aria-hidden>
                    <td colSpan={columnCount} style={{ height: gap, padding: 0 }} />
                  </tr>
                ) : null}
                {entry.row ? (
                  <TableRow row={entry.row} {...rowProps} />
                ) : (
                  <tr {...rowProps}>
                    <th colSpan={columnCount} className={GROUP_HEAD_CELL}>
                      {entry.header}
                    </th>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {items.length > 0 && virtualizer.getTotalSize() > items[items.length - 1].end ? (
            <tr aria-hidden>
              <td
                colSpan={columnCount}
                style={{
                  height: virtualizer.getTotalSize() - items[items.length - 1].end,
                  padding: 0,
                }}
              />
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
