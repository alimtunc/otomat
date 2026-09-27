import { issueShortId, type IssueSummary } from "@otomat/domain";
import { Avatar, IssueSourceGlyph, IssueStatusChip, RunStatusChip } from "@otomat/ui";
import { ColorDot } from "@web/components/issues/color-dot";
import { linearPriorityLabel } from "@web/lib/linear-priority";

export function IssuePreviewOverview({ issue }: { issue: IssueSummary }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
        <IssueSourceGlyph source={issue.source} />
        <span className="font-mono">{issueShortId(issue)}</span>
      </div>
      <h2 className="break-words text-sm font-medium leading-relaxed text-foreground">
        {issue.title}
      </h2>
      <dl className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 text-xs">
        <dt className="text-text-tertiary">Status</dt>
        <dd className="flex min-w-0 items-center gap-1.5 text-text-secondary">
          {issue.source_state_name === null ? (
            <IssueStatusChip status={issue.status} />
          ) : (
            <>
              <ColorDot color={issue.source_state_color} />
              <span className="break-words">{issue.source_state_name}</span>
            </>
          )}
        </dd>
        {issue.source === "local" ? null : (
          <>
            <dt className="text-text-tertiary">Assignee</dt>
            <dd className="flex min-w-0 items-center gap-1.5 text-text-secondary">
              {issue.source_assignee_name === null ? null : (
                <Avatar name={issue.source_assignee_name} size="sm" />
              )}
              <span className="break-all">{issue.source_assignee_name ?? "Unassigned"}</span>
            </dd>
            <dt className="text-text-tertiary">Priority</dt>
            <dd className="text-text-secondary">
              {issue.source_priority === null
                ? "Not available"
                : linearPriorityLabel(issue.source_priority)}
            </dd>
          </>
        )}
        <dt className="text-text-tertiary">Run</dt>
        <dd className="text-text-secondary">
          {issue.workspace.state === "open" ? (
            <RunStatusChip status={issue.workspace.run_status} />
          ) : (
            "No active run"
          )}
        </dd>
        {issue.source !== "local" && issue.status === "blocked" ? (
          <>
            <dt className="text-text-tertiary">Otomat</dt>
            <dd>
              <IssueStatusChip status="blocked" />
            </dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}
