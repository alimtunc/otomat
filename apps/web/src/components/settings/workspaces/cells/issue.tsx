import type { WorkspaceEntry } from "@otomat/domain";
import { FOCUS_RING } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { shortId } from "@web/lib/ids";
import type { TableCellProps } from "@web/lib/table";

export function WorkspaceIssueCell({ row }: TableCellProps<WorkspaceEntry, unknown>) {
  const { issue_id: issueId, issue_identifier: identifier, issue_title: title } = row.original;
  if (issueId === null) return <span className="text-text-tertiary">—</span>;
  return (
    <Link
      to="/issues/$issueId"
      params={{ issueId }}
      title={title ?? undefined}
      className={`flex min-w-0 items-center gap-1.5 ${FOCUS_RING} focus-visible:rounded-sm`}
    >
      <span className="font-mono text-xs text-text-tertiary">{identifier ?? shortId(issueId)}</span>
      <span className="min-w-0 truncate">{title}</span>
    </Link>
  );
}
