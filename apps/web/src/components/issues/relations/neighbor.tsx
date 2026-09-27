import type { LinearIssueNeighbor, LinearIssueRelations } from "@otomat/domain";
import { FOCUS_RING_INSET, Icon, Tooltip, TooltipContent, TooltipTrigger } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { LinearStateIcon } from "@web/components/issues/linear-state-icon";
import { linearPriorityLabel } from "@web/lib/linear-priority";

import { IssueNeighborActivity } from "./activity";

const RELATION_LABEL = { blocks: "Blocked by", blocked_by: "Blocks", related: "Related to" };

export function IssueNeighbor({
  issue,
  relation,
}: {
  issue: LinearIssueNeighbor;
  relation?: { type: LinearIssueRelations["relations"][number]["type"]; identifier: string };
}) {
  const relationship = relation ? RELATION_LABEL[relation.type] : null;
  const content = (
    <>
      <span className="flex items-center gap-1.5 font-mono text-xs text-text-tertiary">
        {issue.identifier}
        {issue.issue_id === null ? (
          <>
            <Icon name="external-link" size="xs" />
            <span className="sr-only">Open in Linear</span>
          </>
        ) : null}
      </span>
      <span className="col-span-2 min-w-0 break-words text-sm leading-relaxed text-foreground @[28rem]:col-span-1 @[28rem]:col-start-2 @[28rem]:row-start-1">
        {issue.title}
      </span>
      <span className="col-start-2 row-start-1 flex min-w-0 items-center justify-end gap-1.5 text-xs text-text-secondary @[28rem]:col-start-3">
        <LinearStateIcon state={issue.state} />
        <span className="truncate">{issue.state.name}</span>
      </span>
    </>
  );
  const className = `grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-md px-2 py-2.5 @[28rem]:grid-cols-[auto_minmax(0,1fr)_auto] ${FOCUS_RING_INSET}`;
  return (
    <div className="rounded-md hover:bg-hover">
      <Tooltip>
        <TooltipTrigger
          delay={350}
          aria-description={`Assignee: ${issue.assignee?.name ?? "Unassigned"}. Priority: ${linearPriorityLabel(issue.priority)}.${relation ? ` ${relationship} ${relation.identifier}.` : ""}`}
          render={
            issue.issue_id === null ? (
              <a href={issue.url} target="_blank" rel="noreferrer" className={className}>
                {content}
              </a>
            ) : (
              <Link
                to="/issues/$issueId"
                params={{ issueId: issue.issue_id }}
                className={className}
              >
                {content}
              </Link>
            )
          }
        />
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
            <dd className="break-words">{issue.assignee?.name ?? "Unassigned"}</dd>
            <dt className="text-text-tertiary">Priority</dt>
            <dd>{linearPriorityLabel(issue.priority)}</dd>
          </dl>
          {relation ? (
            <p className="mt-3 border-t border-border-subtle pt-2.5 text-text-secondary">
              {relationship}{" "}
              <span className="font-mono text-foreground">{relation.identifier}</span>
            </p>
          ) : null}
        </TooltipContent>
      </Tooltip>
      {issue.issue_id === null ? null : <IssueNeighborActivity issueId={issue.issue_id} />}
    </div>
  );
}
