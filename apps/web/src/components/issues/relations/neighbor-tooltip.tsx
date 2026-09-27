import type { LinearIssueNeighbor } from "@otomat/domain";
import { TooltipContent } from "@otomat/ui";
import { LinearStateIcon } from "@web/components/issues/linear-state-icon";

export function IssueNeighborTooltip({
  issue,
  assignee,
  priority,
  relationship,
}: {
  issue: LinearIssueNeighbor;
  assignee: string;
  priority: string;
  relationship: { label: string; identifier: string } | null;
}) {
  return (
    <TooltipContent
      role="tooltip"
      side="left"
      sideOffset={10}
      className="w-80 rounded-lg bg-surface-2 p-3.5 shadow-overlay"
    >
      <div className="flex items-center justify-between gap-3 text-text-tertiary">
        <span className="font-mono">{issue.identifier}</span>
        <span>Linear</span>
      </div>
      <p className="mt-2 text-sm font-medium leading-relaxed">{issue.title}</p>
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2">
        <dt className="text-text-tertiary">Status</dt>
        <dd className="flex items-center gap-1.5">
          <LinearStateIcon state={issue.state} />
          {issue.state.name}
        </dd>
        <dt className="text-text-tertiary">Assignee</dt>
        <dd className="break-words">{assignee}</dd>
        <dt className="text-text-tertiary">Priority</dt>
        <dd>{priority}</dd>
      </dl>
      {relationship === null ? null : (
        <p className="mt-3 border-t border-border-subtle pt-2.5 text-text-secondary">
          {relationship.label}{" "}
          <span className="font-mono text-foreground">{relationship.identifier}</span>
        </p>
      )}
    </TooltipContent>
  );
}
