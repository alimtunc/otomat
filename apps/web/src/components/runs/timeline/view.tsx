import { Skeleton } from "@otomat/ui";
import { useParams } from "@tanstack/react-router";
import { useRunDetail } from "@web/api/runs/queries";
import { useRunEventStream } from "@web/api/runs/run-events-provider";
import { ContextPane } from "@web/components/runs/cockpit/context-pane";
import { FollowUpComposer } from "@web/components/runs/cockpit/follow-up-composer";
import { StepsPane } from "@web/components/runs/cockpit/steps-pane";
import { CompeteComparison } from "@web/components/runs/compete/comparison";
import { PaneHeader } from "@web/components/runs/pane-header";
import { RunTimeline } from "@web/components/runs/timeline/list";
import { DaemonUnreachableState } from "@web/components/shell/daemon-unreachable-state";

export function RunTimelineView() {
  const { runId } = useParams({ from: "/runs/$runId/" });
  const detail = useRunDetail(runId);
  const stream = useRunEventStream();

  if (detail.isPending) {
    return (
      <div className="flex flex-col gap-2 p-6">
        <Skeleton height={20} width="40%" />
        <Skeleton height={14} width="64%" />
      </div>
    );
  }

  if (detail.isError) {
    return (
      <DaemonUnreachableState
        title="Couldn’t load this run"
        onRetry={() => void detail.refetch()}
      />
    );
  }

  const activeCompetition = detail.data.compete_groups.find(
    (group) => group.status === "awaiting_selection" || group.status === "promoting",
  );

  return (
    <div className="grid h-full min-h-0 grid-cols-[226px_1fr_270px]">
      <StepsPane detail={detail.data} />
      <div className="flex min-h-0 min-w-0 flex-col">
        {activeCompetition ? (
          <CompeteComparison
            detail={detail.data}
            group={activeCompetition}
            events={stream.events}
          />
        ) : (
          <>
            <PaneHeader>
              Event timeline
              <span className="ml-auto font-normal normal-case text-text-tertiary">
                {stream.state === "open" ? "ordered by seq · live" : "ordered by seq"}
              </span>
            </PaneHeader>
            <RunTimeline
              events={stream.events}
              steps={detail.data.steps}
              state={stream.state}
              degraded={stream.degraded}
            />
            <FollowUpComposer detail={detail.data} />
          </>
        )}
      </div>
      <ContextPane detail={detail.data} />
    </div>
  );
}
