import { FOCUS_RING } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { CountBadge } from "@web/components/issues/count-badge";
import { IssueLabel } from "@web/components/issues/issue-label";
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
                className={`flex min-w-0 items-center rounded-sm ${FOCUS_RING}`}
              >
                <IssueLabel
                  identifier={issue === null ? shortId(group.issueId) : issueShortId(issue)}
                  title={issue === null ? "Issue not loaded" : issue.title}
                  className="text-sm font-medium text-foreground"
                />
              </Link>
              <CountBadge count={group.runs.length} tone="neutral" />
            </div>
          </th>
        </tr>
      </tbody>
      <tbody>{children}</tbody>
    </>
  );
}
