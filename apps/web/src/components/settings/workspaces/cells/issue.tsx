import { FOCUS_RING } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { IssueLabel } from "@web/components/issues/issue-label";
import { shortId } from "@web/lib/ids";
import type { TableCellProps } from "@web/lib/table";
import type { WorkspaceRow } from "@web/lib/workspace/row";

export function WorkspaceIssueCell({ row }: TableCellProps<WorkspaceRow, unknown>) {
  const { issue_id: issueId, issue_identifier: identifier, issue_title: title } = row.original;
  if (issueId === null) return <span className="text-text-tertiary">—</span>;
  return (
    <Link
      to="/issues/$issueId"
      params={{ issueId }}
      className={`flex min-w-0 items-center ${FOCUS_RING} focus-visible:rounded-sm`}
    >
      <IssueLabel identifier={identifier ?? shortId(issueId)} title={title} />
    </Link>
  );
}
