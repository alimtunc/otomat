import { ErrorState, Skeleton } from "@otomat/ui";
import { useRunDetail } from "@web/api/runs/queries";
import { useRunEventStream } from "@web/api/runs/run-events-provider";
import { ConversationThread } from "@web/components/runs/conversation/thread";

/** Reads the enclosing run event stream, so it only ever renders for the followed run. */
export function ConversationSection({ runId }: { runId: string }) {
  const detail = useRunDetail(runId);
  const stream = useRunEventStream();

  if (detail.isPending) {
    return (
      <div className="flex flex-col gap-2 p-4">
        <Skeleton height={14} width="60%" />
        <Skeleton height={14} width="40%" />
      </div>
    );
  }

  if (detail.isError) {
    return (
      <ErrorState
        variant="inline"
        title="Couldn’t load this run"
        onRetry={() => void detail.refetch()}
      />
    );
  }

  return (
    // The workspace column scrolls as a whole, so the thread is capped here rather than filling.
    <div className="flex max-h-150 flex-col">
      <ConversationThread
        detail={detail.data}
        events={stream.events}
        state={stream.state}
        degraded={stream.degraded}
      />
    </div>
  );
}
