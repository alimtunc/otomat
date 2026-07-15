import type { IssueContract } from "@otomat/domain";
import { IssueStatusChip, RelativeTime } from "@otomat/ui";
import { Link } from "@tanstack/react-router";

const CELL = "h-10 border-b border-border-subtle px-3";

export function IssueRow({ issue }: { issue: IssueContract }) {
  const shortId = issue.source_external_id ?? issue.id.slice(0, 8);
  return (
    <tr className="transition-colors hover:bg-hover">
      <td className={`${CELL} font-mono text-text-tertiary`}>{shortId}</td>
      <td className={`${CELL} relative p-0`}>
        <Link
          to="/issues/$issueId"
          params={{ issueId: issue.id }}
          className="flex h-full items-center px-3 text-foreground after:absolute after:inset-0 focus-visible:[outline:2px_solid_var(--iris-ring)] focus-visible:outline-offset-[-2px]"
        >
          <span className="truncate">{issue.title}</span>
        </Link>
      </td>
      <td className={CELL}>
        <IssueStatusChip status={issue.status} />
      </td>
      <td className={`${CELL} text-text-secondary`}>{issue.source}</td>
      <td className={`${CELL} text-text-tertiary`}>
        {issue.synced_at ? <RelativeTime date={issue.synced_at} addSuffix={false} /> : "—"}
      </td>
    </tr>
  );
}
