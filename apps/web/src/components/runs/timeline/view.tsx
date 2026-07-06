import { ErrorState, Skeleton } from "@otomat/ui";
import { useParams } from "@tanstack/react-router";
import { useRunDetail } from "@web/api/runs/queries";
import { useRunEventStream } from "@web/api/runs/run-events-provider";
import { RunTimeline } from "@web/components/runs/timeline/list";
import { RunStatusBar } from "@web/components/runs/timeline/status-bar";
import { CenteredState } from "@web/components/shell/centered-state";

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
      <CenteredState>
        <ErrorState
          title="Couldn’t load this run"
          description="The daemon is unreachable. Check that it is running, then retry."
          onRetry={() => void detail.refetch()}
        />
      </CenteredState>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <RunStatusBar detail={detail.data} />
      <RunTimeline events={stream.events} state={stream.state} degraded={stream.degraded} />
    </div>
  );
}
