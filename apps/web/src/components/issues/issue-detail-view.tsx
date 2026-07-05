import { Button } from "@otomat/ui";
import { useParams } from "@tanstack/react-router";
import { useIssue } from "@web/api/issues/queries";
import { useStartRunAndNavigate } from "@web/api/runs/mutations";
import { useRunsForIssue } from "@web/api/runs/queries";
import { IssueHeader } from "@web/components/issues/issue-header";
import { RunsList } from "@web/components/runs/launch/list";
import { RouteShell } from "@web/components/shell/route-shell";
import { Play } from "lucide-react";

export function IssueDetailView() {
  const { issueId } = useParams({ from: "/issues/$issueId" });
  const issue = useIssue(issueId);
  const runs = useRunsForIssue(issueId);
  const { start, isPending } = useStartRunAndNavigate();

  async function launch() {
    await start({ issue_id: issueId });
  }

  const title = issue.data?.title ?? `Issue ${issueId}`;

  return (
    <RouteShell
      active="issues"
      breadcrumbs={[
        { label: "Issues", href: "/issues" },
        { label: title, current: true },
      ]}
      actions={
        <Button
          variant="primary"
          size="sm"
          loading={isPending}
          disabled={isPending || issue.isError}
          onClick={launch}
        >
          <Play aria-hidden />
          Start run
        </Button>
      }
    >
      <div className="flex flex-col gap-6 p-6">
        <IssueHeader query={issue} />
        <RunsList query={runs} />
      </div>
    </RouteShell>
  );
}
