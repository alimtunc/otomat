import { issueShortId, shortId } from "@otomat/domain";
import { FOCUS_RING } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { CountBadge } from "@web/components/issues/count-badge";
import { IssueLabel } from "@web/components/issues/issue-label";
import type { RunIssueGroup } from "@web/lib/run/grouping";

export function RunIssueGroupSection({ group }: { group: RunIssueGroup }) {
  const issue = group.issue;
  return (
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
  );
}
