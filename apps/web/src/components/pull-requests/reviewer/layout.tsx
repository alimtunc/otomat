import type { BreadcrumbItem } from "@otomat/ui";
import { Outlet, useParams } from "@tanstack/react-router";
import { usePullRequestReviewContext } from "@web/api/prs/queries";
import { PullRequestIssueContext } from "@web/components/pull-requests/issue-context";
import { PullRequestReviewerActions } from "@web/components/pull-requests/reviewer/actions";
import { PullRequestReviewerTabs } from "@web/components/pull-requests/reviewer/tabs";
import { RouteShell } from "@web/components/shell/route-shell";
import { useBackNavigation } from "@web/components/shell/use-back-navigation";
import { pullRequestLabel } from "@web/lib/pull-request/label";

export function PullRequestReviewerLayout() {
  const { pullRequestId } = useParams({ from: "/pull-requests/$pullRequestId" });
  const query = usePullRequestReviewContext(pullRequestId);
  const pullRequest = query.data?.pull_request;
  const back = useBackNavigation(null);

  const pullRequestCrumb = (): BreadcrumbItem => {
    if (pullRequest !== undefined) return { label: pullRequestLabel(pullRequest) };
    return { label: query.isError ? "Pull request unavailable" : "Loading pull request…" };
  };

  return (
    <RouteShell
      active="reviews"
      back={back}
      breadcrumbs={[
        { label: "Reviews", href: "/reviews" },
        { ...pullRequestCrumb(), current: true },
      ]}
      breadcrumbExtra={
        query.data === undefined ? null : <PullRequestIssueContext issue={query.data.issue} />
      }
      tabs={<PullRequestReviewerTabs pullRequestId={pullRequestId} />}
      actions={
        <PullRequestReviewerActions pullRequestId={pullRequestId} url={pullRequest?.url ?? null} />
      }
    >
      <Outlet />
    </RouteShell>
  );
}
