import { ISSUE_STATES, type IssueContract, type IssueState } from "@otomat/domain";
import { resolveStatus, TONE_TEXT } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { FOCUS_RING } from "@web/lib/focus";
import { issueShortId } from "@web/lib/ids";

// blocked/canceled are hidden per the prototype board; the List layout still shows them.
const HIDDEN_COLUMNS = new Set<IssueState>(["blocked", "canceled"]);
const BOARD_COLUMNS = ISSUE_STATES.filter((status) => !HIDDEN_COLUMNS.has(status));

function BoardCard({ issue }: { issue: IssueContract }) {
  const meta = resolveStatus("issue", issue.status);
  const StatusIcon = meta.icon;
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
          <StatusIcon aria-hidden className={`h-3.25 w-3.25 ${TONE_TEXT[meta.tone]}`} />
          <span className="font-mono">{issueShortId(issue)}</span>
          <span>·</span>
          <span>{issue.source}</span>
        </span>
        <span className="text-sm font-medium leading-[1.35] text-foreground">{issue.title}</span>
        {issue.body ? (
          <span className="line-clamp-2 text-xs leading-[1.4] text-text-tertiary">
            {issue.body}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

export function IssuesBoard({ issues }: { issues: IssueContract[] }) {
  return (
    <div className="grid h-full auto-cols-[300px] grid-flow-col items-start gap-3.5 overflow-x-auto px-4.5 py-4">
      {BOARD_COLUMNS.map((status) => {
        const meta = resolveStatus("issue", status);
        const StatusIcon = meta.icon;
        const columnIssues = issues.filter((issue) => issue.status === status);
        return (
          <section key={status} aria-label={meta.label} className="flex min-h-0 flex-col gap-2">
            <header className="flex h-8 items-center gap-2 px-1 text-sm font-medium text-foreground">
              <StatusIcon aria-hidden className={`h-3.5 w-3.5 ${TONE_TEXT[meta.tone]}`} />
              {meta.label}
              <span className="inline-flex h-4.25 min-w-4.25 items-center justify-center rounded-full bg-surface-3 px-1.25 text-micro font-medium tabular-nums text-text-secondary">
                {columnIssues.length}
              </span>
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
