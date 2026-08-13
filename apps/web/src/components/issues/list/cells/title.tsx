import type { IssueContract } from "@otomat/domain";
import { FOCUS_RING } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import type { TableCellProps } from "@web/lib/table";

export function IssueTitleCell({ row, getValue }: TableCellProps<IssueContract, string>) {
  return (
    <Link
      to="/issues/$issueId"
      params={{ issueId: row.original.id }}
      className={`flex h-full items-center px-3 text-foreground after:absolute after:inset-0 ${FOCUS_RING} focus-visible:outline-offset-[-2px]`}
    >
      <span className="truncate">{getValue()}</span>
    </Link>
  );
}
