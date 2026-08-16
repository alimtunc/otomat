import { projectIssuePrimaryState } from "@otomat/domain";
import { FOCUS_RING, IssueStatusChip } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { CountBadge } from "@web/components/issues/count-badge";
import { issueShortId, shortId } from "@web/lib/ids";
import type { RunIssueGroup } from "@web/lib/run/grouping";
import { GROUP_HEAD_CELL } from "@web/lib/table";
import type { ReactNode } from "react";

export interface RunIssueGroupSectionProps {
  group: RunIssueGroup;
  columnCount: number;
  children: ReactNode;
}

export function RunIssueGroupSection({ group, columnCount, children }: RunIssueGroupSectionProps) {
  const issue = group.issue;
  return (
    <>
      <tbody>
        <tr>
          <th scope="colgroup" colSpan={columnCount} className={GROUP_HEAD_CELL}>
            <div className="flex h-9 items-center gap-2 px-3">
              <Link
                to="/issues/$issueId"
                params={{ issueId: group.issueId }}
                className={`flex min-w-0 items-center gap-2 rounded-sm ${FOCUS_RING}`}
              >
                <span className="font-mono text-xs text-text-tertiary">
                  {issue === null ? shortId(group.issueId) : issueShortId(issue)}
                </span>
                <span className="truncate text-sm font-medium text-foreground">
                  {issue === null ? "Issue not loaded" : issue.title}
                </span>
              </Link>
              {issue === null ? null : (
                <IssueStatusChip status={projectIssuePrimaryState(issue).state} />
              )}
              <CountBadge count={group.runs.length} tone="neutral" />
            </div>
          </th>
        </tr>
      </tbody>
      <tbody>{children}</tbody>
    </>
  );
}
