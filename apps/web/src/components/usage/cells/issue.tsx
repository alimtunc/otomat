import type { UsageRunRow } from "@otomat/domain";
import { FOCUS_RING } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { IssueLabel } from "@web/components/issues/issue-label";
import type { TableCellProps } from "@web/lib/table";

export function UsageIssueCell({ row }: TableCellProps<UsageRunRow, string>) {
  const { issue_id, issue_identifier, issue_title } = row.original;
  return (
    <Link
      to="/issues/$issueId"
      params={{ issueId: issue_id }}
      className={`flex min-w-0 items-center hover:text-foreground ${FOCUS_RING} focus-visible:rounded-sm`}
    >
      <IssueLabel
        identifier={issue_identifier}
        title={issue_title}
        className="text-text-secondary"
      />
    </Link>
  );
}
