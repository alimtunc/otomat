import type { UsageRunRow } from "@otomat/domain";
import type { TableCellProps } from "@web/lib/table";
import { formatDurationMs } from "@web/lib/usage/format";

export function UsageDurationCell({ getValue }: TableCellProps<UsageRunRow, number | null>) {
  const span = getValue();
  return span === null ? (
    <span className="text-xs text-text-tertiary">Not measured</span>
  ) : (
    <span className="font-mono text-xs tabular-nums text-text-secondary">
      {formatDurationMs(span)}
    </span>
  );
}
