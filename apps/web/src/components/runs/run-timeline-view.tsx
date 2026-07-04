import { ErrorState, Skeleton } from "@otomat/ui";
import { useParams } from "@tanstack/react-router";
import { useRunDetail, useRunEvents } from "@web/api/runs/queries";
import { RunStatusBar } from "@web/components/runs/run-status-bar";
import { RunTimeline } from "@web/components/runs/run-timeline";

export function RunTimelineView() {
  const { runId } = useParams({ from: "/runs/$runId/" });
  const detail = useRunDetail(runId);
  const stream = useRunEvents(runId);

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
      <div className="grid h-full place-items-center p-6">
        <ErrorState
          title="Couldn’t load this run"
          description="The daemon is unreachable. Check that it is running, then retry."
          onRetry={() => void detail.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <RunStatusBar detail={detail.data} />
      <RunTimeline events={stream.events} state={stream.state} degraded={stream.degraded} />
    </div>
  );
}
