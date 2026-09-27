import type { LinearIssueNeighbor, LinearIssueRelation } from "@otomat/domain";
import { FOCUS_RING_INSET, Icon, Tooltip, TooltipTrigger } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { LinearStateIcon } from "@web/components/issues/linear-state-icon";
import { linearPriorityLabel } from "@web/lib/linear-priority";

import { IssueNeighborActivity } from "./activity";
import { IssueNeighborTooltip } from "./neighbor-tooltip";
import { INVERSE_RELATION_LABEL } from "./relation-labels";

const LINK_CLASS = `grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-md px-2 py-2.5 @[28rem]:grid-cols-[auto_minmax(0,1fr)_auto] ${FOCUS_RING_INSET}`;

export function IssueNeighbor({
  issue,
  relation,
}: {
  issue: LinearIssueNeighbor;
  relation?: { type: LinearIssueRelation["type"]; identifier: string };
}) {
  const assignee = issue.assignee?.name ?? "Unassigned";
  const priority = linearPriorityLabel(issue.priority);
  const relationship = relation
    ? { label: INVERSE_RELATION_LABEL[relation.type], identifier: relation.identifier }
    : null;
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
  return (
    <div className="rounded-md hover:bg-hover">
      <Tooltip>
        <TooltipTrigger
          delay={350}
          aria-description={`Assignee: ${assignee}. Priority: ${priority}.${relationship === null ? "" : ` ${relationship.label} ${relationship.identifier}.`}`}
          render={
            issue.issue_id === null ? (
              <a href={issue.url} target="_blank" rel="noreferrer" className={LINK_CLASS}>
                {content}
              </a>
            ) : (
              <Link
                to="/issues/$issueId"
                params={{ issueId: issue.issue_id }}
                className={LINK_CLASS}
              >
                {content}
              </Link>
            )
          }
        />
        <IssueNeighborTooltip
          issue={issue}
          assignee={assignee}
          priority={priority}
          relationship={relationship}
        />
      </Tooltip>
      {issue.issue_id === null ? null : <IssueNeighborActivity issueId={issue.issue_id} />}
    </div>
  );
}
