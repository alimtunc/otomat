import type { RunContract } from "@otomat/domain";
import { RelativeTime } from "@otomat/ui";
import type { TableCellProps } from "@web/lib/table";

export function RunUpdatedCell({ getValue }: TableCellProps<RunContract, string>) {
  return <RelativeTime date={getValue()} addSuffix={false} />;
}
