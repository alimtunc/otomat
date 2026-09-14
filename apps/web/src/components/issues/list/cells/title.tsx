import type { IssueSummary } from "@otomat/domain";
import { FOCUS_RING_INSET } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import type { TableCellProps } from "@web/lib/table";

export function IssueTitleCell({ row, getValue }: TableCellProps<IssueSummary, string>) {
  return (
    <Link
      to="/issues/$issueId"
      params={{ issueId: row.original.id }}
      title={getValue()}
      className={`flex h-full min-w-0 items-center px-3 text-foreground after:absolute after:inset-0 ${FOCUS_RING_INSET}`}
    >
      <span className="truncate">{getValue()}</span>
    </Link>
  );
}
