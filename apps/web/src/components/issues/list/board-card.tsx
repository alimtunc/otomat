import type { IssueContract } from "@otomat/domain";
import {
  Avatar,
  FOCUS_RING,
  IssueSourceGlyph,
  IssueStatusChip,
  resolveStatus,
  TONE_TEXT,
} from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { ColorDot } from "@web/components/issues/color-dot";
import { CardChips } from "@web/components/issues/list/card-chips";
import { issueShortId } from "@web/lib/ids";
import { boardColumnFor, divergentSourceStatus } from "@web/lib/issue/board-column";
import { failureSummary } from "@web/lib/issue/execution-failure";

export function BoardCard({ issue }: { issue: IssueContract }) {
  const meta = resolveStatus("issue", boardColumnFor(issue));
  const StatusIcon = meta.icon;
  const sourceStatus = divergentSourceStatus(issue);
  const failure = issue.execution.state === "failed" ? issue.execution.failure : null;
  return (
    <li>
      <Link
        to="/issues/$issueId"
        params={{ issueId: issue.id }}
        className={`flex flex-col gap-1.75 rounded-lg border border-border-subtle bg-surface-1 px-3 py-2.75 hover:border-border hover:bg-surface-2 hover:shadow-[var(--shadow-sm)] hover:-translate-y-px ${FOCUS_RING}`}
        style={{
          transition:
            "background var(--motion-fast) var(--ease), border-color var(--motion-fast) var(--ease), transform var(--motion-fast) var(--ease), box-shadow var(--motion-fast) var(--ease)",
        }}
      >
        <span className="flex items-center gap-1.75 text-xs tabular-nums text-text-tertiary">
          <IssueSourceGlyph source={issue.source} />
          <span className="font-mono">{issueShortId(issue)}</span>
          {issue.source_state_name !== null ? (
            <span className="inline-flex min-w-0 items-center gap-1 truncate">
              <ColorDot color={issue.source_state_color} />
              <span className="truncate text-micro">{issue.source_state_name}</span>
            </span>
          ) : null}
          <span className="flex-1" />
          {issue.source_assignee_name !== null ? (
            <Avatar name={issue.source_assignee_name} size="sm" />
          ) : null}
        </span>
        <span className="flex items-start gap-1.75">
          <StatusIcon
            aria-hidden
            className={`mt-0.75 h-3.25 w-3.25 shrink-0 ${TONE_TEXT[meta.tone]}`}
          />
          <span className="text-sm font-medium leading-[1.35] text-foreground">{issue.title}</span>
        </span>
        {failure === null ? null : (
          <span className="truncate text-micro text-danger">{failureSummary(failure)}</span>
        )}
        <span className="flex flex-wrap items-center gap-1">
          {sourceStatus !== null ? <IssueStatusChip status={sourceStatus} /> : null}
          <CardChips issue={issue} />
        </span>
      </Link>
    </li>
  );
}
