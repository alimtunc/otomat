import type { RunSummary } from "@otomat/domain";
import { RelativeTime } from "@otomat/ui";
import type { TableCellProps } from "@web/lib/table";

export function RunUpdatedCell({ getValue }: TableCellProps<RunSummary, string>) {
  return <RelativeTime date={getValue()} addSuffix={false} />;
}
