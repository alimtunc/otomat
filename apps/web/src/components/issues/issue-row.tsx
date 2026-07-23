import type { IssueContract } from "@otomat/domain";
import { Avatar, cn, IssueSourceGlyph, IssueStatusChip, RelativeTime } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { IssueExecutionChip } from "@web/components/issues/execution-chip";
import { FOCUS_RING } from "@web/lib/focus";
import { issueShortId } from "@web/lib/ids";
import { CELL } from "@web/lib/table";

export function IssueRow({ issue }: { issue: IssueContract }) {
  return (
    <tr className="relative transition-colors hover:bg-hover">
      <td className={`${CELL} font-mono text-text-tertiary`}>{issueShortId(issue)}</td>
      <td className={cn(CELL, "p-0")}>
        <Link
          to="/issues/$issueId"
          params={{ issueId: issue.id }}
          className={`flex h-full items-center px-3 text-foreground after:absolute after:inset-0 ${FOCUS_RING} focus-visible:outline-offset-[-2px]`}
        >
          <span className="truncate">{issue.title}</span>
        </Link>
      </td>
      <td className={CELL}>
        <span className="flex items-center gap-1.5">
          <IssueStatusChip status={issue.status} />
          <IssueExecutionChip execution={issue.execution} />
        </span>
      </td>
      <td className={`${CELL} text-text-secondary`}>
        <span className="flex items-center gap-1.5">
          <IssueSourceGlyph source={issue.source} />
          {issue.source}
        </span>
      </td>
      <td className={CELL}>
        {issue.source_assignee_name !== null ? (
          <span className="flex items-center gap-1.5 text-text-secondary">
            <Avatar name={issue.source_assignee_name} size="sm" />
            <span className="truncate">{issue.source_assignee_name}</span>
          </span>
        ) : (
          <span className="text-text-tertiary">—</span>
        )}
      </td>
      <td className={`${CELL} text-text-tertiary`}>
        {issue.synced_at ? <RelativeTime date={issue.synced_at} addSuffix={false} /> : "—"}
      </td>
    </tr>
  );
}
