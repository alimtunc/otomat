import type { RunContract } from "@otomat/domain";
import { EmptyState, ErrorState, IssueStatusChip, Skeleton } from "@otomat/ui";
import { useParams } from "@tanstack/react-router";
import { useIssue } from "@web/api/issues/queries";
import { useRunsForIssue } from "@web/api/runs/queries";
import { RunEventsProvider } from "@web/api/runs/run-events-provider";
import { IssueHeader } from "@web/components/issues/issue-header";
import { ActivityFeed } from "@web/components/issues/workspace/activity-feed";
import { LaunchRunPopover } from "@web/components/issues/workspace/launch-run-popover";
import { LinearCommentsSection } from "@web/components/issues/workspace/linear/comments-section";
import { WorkspaceRail } from "@web/components/issues/workspace/rail/workspace-rail";
import { RunStrip } from "@web/components/issues/workspace/run-strip";
import { QueryList } from "@web/components/shell/query-list";
import { RouteShell } from "@web/components/shell/route-shell";
import { issueShortId, shortId } from "@web/lib/ids";
import { resolveFollowedRun } from "@web/lib/run-activity";
import { useState } from "react";

function NoRunsEmptyState({
  issueId,
  onLaunched,
}: {
  issueId: string;
  onLaunched: (run: RunContract) => void;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-card">
      <EmptyState
        icon="play"
        variant="inline"
        title="No runs yet"
        description="This issue has no agent activity. Launch a run to follow its live ledger here."
        action={<LaunchRunPopover issueId={issueId} onLaunched={onLaunched} />}
      />
    </div>
  );
}

function RunsArea({
  query,
  issueId,
  followedRun,
  onFollow,
}: {
  query: ReturnType<typeof useRunsForIssue>;
  issueId: string;
  followedRun: RunContract | null;
  onFollow: (run: RunContract) => void;
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
      empty={<NoRunsEmptyState issueId={issueId} onLaunched={onFollow} />}
    >
      {(runs) => (
        <>
          <RunStrip
            runs={runs}
            followedRunId={followedRun?.id ?? null}
            onFollow={(runId) => {
              const run = runs.find((candidate) => candidate.id === runId);
              if (run) onFollow(run);
            }}
          />
          {followedRun ? <ActivityFeed run={followedRun} /> : null}
        </>
      )}
    </QueryList>
  );
}

/**
 * Issue workspace: issue prose, its real runs, and the followed run's ledger
 * activity — one SSE stream for the followed run feeds the feed and the rail.
 */
export function IssueDetailView() {
  const { issueId } = useParams({ from: "/issues/$issueId" });
  const issue = useIssue(issueId);
  const runs = useRunsForIssue(issueId);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const followedRun = resolveFollowedRun(runs.data ?? [], selectedRunId);

  const idLabel = issue.data ? issueShortId(issue.data) : shortId(issueId);

  const body = (
    <div className="grid grid-cols-1 lg:h-full lg:min-h-0 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0 px-8 py-6.5 lg:overflow-auto">
        <div className="flex max-w-180 flex-col gap-6">
          <IssueHeader query={issue} />
          {issue.data?.source === "linear" ? (
            <LinearCommentsSection issueId={issueId} runId={followedRun?.id ?? null} />
          ) : null}
          <RunsArea
            query={runs}
            issueId={issueId}
            followedRun={followedRun}
            onFollow={(run) => setSelectedRunId(run.id)}
          />
        </div>
      </div>
      {issue.data ? <WorkspaceRail issue={issue.data} run={followedRun} /> : <div />}
    </div>
  );

  return (
    <RouteShell
      active="issues"
      breadcrumbs={[
        { label: "Issues", href: "/issues" },
        { label: idLabel, current: true },
      ]}
      breadcrumbExtra={issue.data ? <IssueStatusChip status={issue.data.status} /> : null}
      actions={
        <LaunchRunPopover issueId={issueId} onLaunched={(run) => setSelectedRunId(run.id)} />
      }
    >
      {followedRun ? <RunEventsProvider runId={followedRun.id}>{body}</RunEventsProvider> : body}
    </RouteShell>
  );
}
