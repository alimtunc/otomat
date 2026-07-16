import type { IssueContract, IssueState } from "@otomat/domain";
import { resolveStatus } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { TONE_TEXT } from "@web/lib/status-tone";

const BOARD_COLUMNS: IssueState[] = ["backlog", "ready", "running", "reviewing", "pr_open", "done"];

function BoardCard({ issue }: { issue: IssueContract }) {
  const meta = resolveStatus("issue", issue.status);
  const StatusIcon = meta.icon;
  const shortId = issue.source_external_id ?? issue.id.slice(0, 8);
  return (
    <li>
      <Link
        to="/issues/$issueId"
        params={{ issueId: issue.id }}
        className="flex flex-col gap-1.75 rounded-lg border border-border-subtle bg-surface-1 px-3 py-2.75 hover:border-border hover:bg-surface-2 hover:shadow-[var(--shadow-sm)] hover:-translate-y-px focus-visible:[outline:2px_solid_var(--iris-ring)]"
        style={{
          transition:
            "background var(--motion-fast) var(--ease), border-color var(--motion-fast) var(--ease), transform var(--motion-fast) var(--ease), box-shadow var(--motion-fast) var(--ease)",
        }}
      >
        <span className="flex items-center gap-1.75 text-xs tabular-nums text-text-tertiary">
          <StatusIcon aria-hidden className={`h-3.25 w-3.25 ${TONE_TEXT[meta.tone]}`} />
          <span className="font-mono">{shortId}</span>
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
        const columnLabel = meta.label.charAt(0).toUpperCase() + meta.label.slice(1);
        const columnIssues = issues.filter((issue) => issue.status === status);
        return (
          <section key={status} aria-label={columnLabel} className="flex min-h-0 flex-col gap-2">
            <header className="flex h-8 items-center gap-2 px-1 text-sm font-medium text-foreground">
              <StatusIcon aria-hidden className={`h-3.5 w-3.5 ${TONE_TEXT[meta.tone]}`} />
              {columnLabel}
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
