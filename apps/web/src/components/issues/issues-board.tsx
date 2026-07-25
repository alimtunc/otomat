import type { IssueContract } from "@otomat/domain";
import { Avatar, IssueSourceGlyph, IssueStatusChip, resolveStatus, TONE_TEXT } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { ColorDot } from "@web/components/issues/color-dot";
import { CountBadge } from "@web/components/issues/count-badge";
import { boardColumnFor, divergentSourceStatus, visibleBoardColumns } from "@web/lib/board-columns";
import { FOCUS_RING } from "@web/lib/focus";
import { issueShortId } from "@web/lib/ids";
import { linearPriorityLabel } from "@web/lib/linear-priority";

const CARD_CHIP_CLASS =
  "inline-flex h-4.5 items-center gap-1 rounded-full border border-border-subtle px-1.75 text-micro text-text-secondary";

function CardChips({ issue }: { issue: IssueContract }) {
  const priority = issue.source_priority;
  const showPriority = priority !== null && priority !== 0;
  const labels = issue.source_labels ?? [];
  if (!showPriority && labels.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {showPriority ? (
        <span className={CARD_CHIP_CLASS}>{linearPriorityLabel(priority)}</span>
      ) : null}
      {labels.map((label) => (
        <span key={label.name} className={CARD_CHIP_CLASS}>
          <ColorDot color={label.color} />
          {label.name}
        </span>
      ))}
    </span>
  );
}

function BoardCard({ issue }: { issue: IssueContract }) {
  const meta = resolveStatus("issue", boardColumnFor(issue));
  const StatusIcon = meta.icon;
  const sourceStatus = divergentSourceStatus(issue);
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
        <span className="flex flex-wrap items-center gap-1">
          {sourceStatus !== null ? <IssueStatusChip status={sourceStatus} /> : null}
          <CardChips issue={issue} />
        </span>
      </Link>
    </li>
  );
}

export function IssuesBoard({ issues }: { issues: IssueContract[] }) {
  const columns = visibleBoardColumns(issues);
  if (columns.length === 0) {
    return (
      <p className="px-4.5 py-6 text-sm text-text-tertiary">
        These issues aren’t shown on the board — switch to List to see them.
      </p>
    );
  }
  return (
    <div className="grid h-full auto-cols-[300px] grid-flow-col items-start gap-3.5 overflow-x-auto px-4.5 py-4">
      {columns.map(({ status, issues: columnIssues }) => {
        const meta = resolveStatus("issue", status);
        const StatusIcon = meta.icon;
        return (
          <section key={status} aria-label={meta.label} className="flex min-h-0 flex-col gap-2">
            <header className="flex h-8 items-center gap-2 px-1 text-sm font-medium text-foreground">
              <StatusIcon aria-hidden className={`h-3.5 w-3.5 ${TONE_TEXT[meta.tone]}`} />
              {meta.label}
              <CountBadge count={columnIssues.length} tone="neutral" />
            </header>
            <ul className="flex flex-col gap-2">
              {columnIssues.map((issue) => (
                <BoardCard key={issue.id} issue={issue} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
