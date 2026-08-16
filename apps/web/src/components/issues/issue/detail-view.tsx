import type { RunContract } from "@otomat/domain";
import {
  EmptyState,
  ErrorState,
  ResizablePanel,
  ResizablePanelGroup,
  SidePanel,
  Skeleton,
  useMediaQuery,
  usePanelGroupLayout,
  WIDE_VIEWPORT_MEDIA_QUERY,
} from "@otomat/ui";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useIssue } from "@web/api/issues/queries";
import { useRunsForIssue } from "@web/api/runs/queries";
import { RunEventsProvider } from "@web/api/runs/run-events-provider";
import { IssueHeader } from "@web/components/issues/issue/header";
import { IssuePrimaryStateBadge } from "@web/components/issues/issue/primary-state-badge";
import { LaunchRunDialog } from "@web/components/issues/workspace/launch/dialog";
import { LinearCommentsSection } from "@web/components/issues/workspace/linear/comments";
import { WorkspaceRail } from "@web/components/issues/workspace/rail/workspace-rail";
import { RunConversations } from "@web/components/issues/workspace/run-conversations";
import { RunActionsMenu } from "@web/components/runs/actions/run-actions-menu";
import { QueryList } from "@web/components/shell/query-list";
import { RouteShell } from "@web/components/shell/route-shell";
import { useBackNavigation } from "@web/components/shell/use-back-navigation";
import { issueShortId, shortId } from "@web/lib/ids";
import { resolveFollowedRun } from "@web/lib/run/activity";
import type { ReactNode } from "react";

function NoRunsEmptyState({ launchAction }: { launchAction: ReactNode }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-card">
      <EmptyState
        icon="play"
        variant="inline"
        title="No runs yet"
        description="This issue has no agent activity. Launch a run to follow its live ledger here."
        action={launchAction}
      />
    </div>
  );
}

function RailPlaceholder() {
  return (
    <div className="flex flex-col gap-3 px-3.5 py-3">
      <Skeleton height={18} />
      <Skeleton height={18} width="70%" />
      <Skeleton height={18} width="85%" />
    </div>
  );
}

function RunsArea({
  query,
  launchAction,
  followedRun,
  onFollow,
}: {
  query: ReturnType<typeof useRunsForIssue>;
  launchAction: ReactNode;
  followedRun: RunContract | null;
  onFollow: (runId: string) => void;
}) {
  return (
    <QueryList
      query={query}
      pending={<Skeleton height={44} />}
      error={
        <ErrorState
          variant="inline"
          title="Couldn’t load runs"
          onRetry={() => void query.refetch()}
        />
      }
      empty={<NoRunsEmptyState launchAction={launchAction} />}
    >
      {(runs) => (
        <RunConversations runs={runs} followedRunId={followedRun?.id ?? null} onFollow={onFollow} />
      )}
    </QueryList>
  );
}

/** A single SSE stream, opened for the followed run, feeds both its thread and the rail. */
export function IssueDetailView() {
  const { issueId } = useParams({ from: "/issues/$issueId" });
  const { run: selectedRunId } = useSearch({ from: "/issues/$issueId" });
  const navigate = useNavigate();
  const issue = useIssue(issueId);
  const runs = useRunsForIssue(issueId);
  const back = useBackNavigation(null);
  const followedRun = resolveFollowedRun(runs.data ?? [], selectedRunId ?? null);
  const wide = useMediaQuery(WIDE_VIEWPORT_MEDIA_QUERY);
  const railLayout = usePanelGroupLayout("otomat.issue-detail");

  const follow = (runId: string): void => {
    void navigate({
      to: "/issues/$issueId",
      params: { issueId },
      search: { run: runId },
      replace: true,
    });
  };

  const idLabel = issue.data ? issueShortId(issue.data) : shortId(issueId);
  const launchAction = <LaunchRunDialog issue={issue.data} onLaunched={(run) => follow(run.id)} />;
  // The header acts on the issue's canonical cycle, not on whichever old run is being read.
  const cycleRunId = issue.data?.workspace.run_id ?? followedRun?.id ?? null;

  const main = (
    <div className="min-h-0 min-w-0 flex-1 overflow-auto px-8 py-6.5">
      <div className="flex max-w-180 flex-col gap-6">
        <IssueHeader query={issue} />
        {issue.data?.source === "linear" ? (
          <LinearCommentsSection issueId={issueId} runId={followedRun?.id ?? null} />
        ) : null}
        <RunsArea
          query={runs}
          launchAction={launchAction}
          followedRun={followedRun}
          onFollow={follow}
        />
      </div>
    </div>
  );
  const rail = issue.data ? <WorkspaceRail issue={issue.data} run={followedRun} /> : null;

  const body = wide ? (
    <ResizablePanelGroup {...railLayout} className="h-full min-h-0">
      <ResizablePanel id="issue" minSize="40%">
        {main}
      </ResizablePanel>
      <SidePanel
        id="issue-rail"
        label="Issue details"
        side="right"
        defaultSize={300}
        minSize={240}
        maxSize="36%"
      >
        {rail ?? <RailPlaceholder />}
      </SidePanel>
    </ResizablePanelGroup>
  ) : (
    <div>
      {main}
      {rail}
    </div>
  );

  return (
    <RouteShell
      active="issues"
      back={back}
      breadcrumbs={[
        { label: "Issues", href: "/issues" },
        { label: idLabel, current: true },
      ]}
      breadcrumbExtra={issue.data ? <IssuePrimaryStateBadge issue={issue.data} /> : null}
      actions={
        <>
          {launchAction}
          {cycleRunId ? <RunActionsMenu runId={cycleRunId} /> : null}
        </>
      }
    >
      {followedRun ? <RunEventsProvider runId={followedRun.id}>{body}</RunEventsProvider> : body}
    </RouteShell>
  );
}
