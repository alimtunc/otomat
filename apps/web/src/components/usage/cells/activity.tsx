import type { UsageRunRow } from "@otomat/domain";
import { RelativeTime } from "@otomat/ui";
import type { TableCellProps } from "@web/lib/table";

export function UsageActivityCell({ getValue }: TableCellProps<UsageRunRow, string>) {
  return <RelativeTime date={getValue()} addSuffix={false} />;
}
