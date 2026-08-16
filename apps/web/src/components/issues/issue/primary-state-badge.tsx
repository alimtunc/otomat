import { projectIssuePrimaryState, type IssueContract } from "@otomat/domain";
import { FOCUS_RING, IssueStatusChip } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { shortId } from "@web/lib/ids";

export function IssuePrimaryStateBadge({ issue }: { issue: IssueContract }) {
  const primary = projectIssuePrimaryState(issue);
  if (primary.axis === "status") return <IssueStatusChip status={primary.state} />;
  return (
    <Link
      to="/issues/$issueId"
      params={{ issueId: issue.id }}
      search={{ run: primary.run_id }}
      title={`Follow run ${shortId(primary.run_id)}, which holds this issue's workspace`}
      className={`rounded-full ${FOCUS_RING}`}
    >
      <IssueStatusChip status={primary.state} />
    </Link>
  );
}
