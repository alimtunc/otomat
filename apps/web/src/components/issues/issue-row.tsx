import type { IssueContract } from "@otomat/domain";
import { IssueStatusChip } from "@otomat/ui";
import { Link } from "@tanstack/react-router";

export function IssueRow({ issue }: { issue: IssueContract }) {
  return (
    <li>
      <Link
        to="/issues/$issueId"
        params={{ issueId: issue.id }}
        className="flex items-center gap-3 px-6 py-3 hover:bg-hover"
      >
        <IssueStatusChip status={issue.status} showLabel={false} />
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{issue.title}</span>
        <span className="font-mono text-xs text-text-tertiary">{issue.source}</span>
      </Link>
    </li>
  );
}
