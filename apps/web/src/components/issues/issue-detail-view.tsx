import { Button, Icon, IssueStatusChip } from "@otomat/ui";
import { useParams } from "@tanstack/react-router";
import { useIssue } from "@web/api/issues/queries";
import { useStartRunAndNavigate } from "@web/api/runs/mutations";
import { useRunsForIssue } from "@web/api/runs/queries";
import { IssueHeader } from "@web/components/issues/issue-header";
import { IssueRail } from "@web/components/issues/issue-rail";
import { RunsList } from "@web/components/runs/list/list";
import { RouteShell } from "@web/components/shell/route-shell";
import { issueShortId, shortId } from "@web/lib/ids";

export function IssueDetailView() {
  const { issueId } = useParams({ from: "/issues/$issueId" });
  const issue = useIssue(issueId);
  const runs = useRunsForIssue(issueId);
  const { start, isPending } = useStartRunAndNavigate();

  async function launch() {
    await start({ issue_id: issueId });
  }

  const idLabel = issue.data ? issueShortId(issue.data) : shortId(issueId);

  return (
    <RouteShell
      active="issues"
      breadcrumbs={[
        { label: "Issues", href: "/issues" },
        { label: idLabel, current: true },
      ]}
      breadcrumbExtra={issue.data ? <IssueStatusChip status={issue.data.status} /> : null}
      actions={
        <Button
          variant="primary"
          size="sm"
          loading={isPending}
          disabled={isPending || issue.isError}
          onClick={launch}
        >
          <Icon name="play" aria-hidden />
          Launch run
        </Button>
      }
    >
      <div className="grid h-full min-h-0 grid-cols-[1fr_300px]">
        <div className="min-w-0 overflow-auto px-8 py-6.5">
          <div className="flex max-w-180 flex-col gap-6">
            <IssueHeader query={issue} />
            <RunsList query={runs} />
          </div>
        </div>
        {issue.data ? <IssueRail issue={issue.data} latestRun={runs.data?.at(-1)} /> : <div />}
      </div>
    </RouteShell>
  );
}
