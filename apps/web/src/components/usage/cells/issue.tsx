import type { UsageRunRow } from "@otomat/domain";
import { FOCUS_RING } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import type { TableCellProps } from "@web/lib/table";

export function UsageIssueCell({ row }: TableCellProps<UsageRunRow, string>) {
  const { issue_id, issue_identifier, issue_title } = row.original;
  return (
    <Link
      to="/issues/$issueId"
      params={{ issueId: issue_id }}
      title={issue_title}
      className={`flex min-w-0 items-center gap-1.5 hover:text-foreground ${FOCUS_RING} focus-visible:rounded-sm`}
    >
      {issue_identifier === null ? null : (
        <span className="shrink-0 font-mono text-xs text-text-tertiary">{issue_identifier}</span>
      )}
      <span className="truncate text-text-secondary">{issue_title}</span>
    </Link>
  );
}
