import type { UsageRunRow } from "@otomat/domain";
import { FOCUS_RING } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import type { TableCellProps } from "@web/lib/table";

export function UsageRunCell({ row }: TableCellProps<UsageRunRow, string>) {
  return (
    <Link
      to="/runs/$runId"
      params={{ runId: row.original.run_id }}
      className={`font-mono text-text-secondary hover:text-foreground ${FOCUS_RING} focus-visible:rounded-sm`}
    >
      {row.original.run_id.slice(0, 8)}
    </Link>
  );
}
