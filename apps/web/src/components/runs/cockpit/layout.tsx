import type { BreadcrumbItem } from "@otomat/ui";
import { Outlet, useParams } from "@tanstack/react-router";
import { useIssue } from "@web/api/issues/queries";
import { useRunDetail } from "@web/api/runs/queries";
import { RunEventsProvider } from "@web/api/runs/run-events-provider";
import { RunIdentity } from "@web/components/runs/cockpit/run/identity";
import { CockpitTabs } from "@web/components/runs/cockpit/tabs";
import { RouteShell } from "@web/components/shell/route-shell";
import { useBackNavigation } from "@web/components/shell/use-back-navigation";
import { runIssueLabel, UNLINKED_RUN_LABEL } from "@web/lib/run/issue-label";

export function RunCockpitLayout() {
  const { runId } = useParams({ from: "/runs/$runId" });
  const detail = useRunDetail(runId);
  const issueId = detail.data?.run.issue_id ?? null;
  const issue = useIssue(issueId);
  const back = useBackNavigation(issueId);

  const issueCrumb = (): BreadcrumbItem => {
    if (detail.data === undefined) return { label: "Loading issue…" };
    if (issueId === null) return { label: UNLINKED_RUN_LABEL };
    const href = `/issues/${issueId}`;
    if (issue.data !== undefined) return { label: runIssueLabel(issue.data), href };
    return { label: issue.isError ? "Issue unavailable" : "Loading issue…", href };
  };

  return (
    <RunEventsProvider runId={runId}>
      <RouteShell
        active="runs"
        back={back}
        breadcrumbs={[
          { label: "Runs", href: "/runs" },
          issueCrumb(),
          { label: "Run", current: true },
        ]}
        breadcrumbExtra={<RunIdentity runId={runId} status={detail.data?.run.status} />}
        tabs={<CockpitTabs runId={runId} />}
      >
        <Outlet />
      </RouteShell>
    </RunEventsProvider>
  );
}
