import { isRunWorking, type EventEnvelope, type RunDetail } from "@otomat/domain";
import { EmptyState, ErrorState, Skeleton } from "@otomat/ui";
import { useRunContributions } from "@web/api/runs/queries";
import type { RunStreamState } from "@web/api/runs/run-event-stream";
import { ConversationComposer } from "@web/components/runs/conversation/composer";
import { JumpToLatest } from "@web/components/runs/conversation/jump-to-latest";
import { QueuedBanner } from "@web/components/runs/conversation/queued-banner";
import { ThreadItem } from "@web/components/runs/conversation/thread-item";
import { useThreadAutoscroll } from "@web/components/runs/conversation/use-thread-autoscroll";
import { WorkingRow } from "@web/components/runs/conversation/working-row";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { buildConversation } from "@web/lib/conversation";

/** Ordering comes from the ledger, delivery state from the contributions read model. */
export function ConversationThread({
  detail,
  events,
  state,
  degraded,
}: {
  detail: RunDetail;
  events: EventEnvelope[];
  state: RunStreamState;
  degraded: boolean;
}) {
  const contributions = useRunContributions(detail.run.id);
  const autoscroll = useThreadAutoscroll(detail.run.id);
  const working = isRunWorking(detail.run.status);

  return (
    <QueryBoundary
      query={contributions}
      pending={
        <div className="flex flex-col gap-2 p-6">
          <Skeleton height={14} width="55%" />
          <Skeleton height={14} width="35%" />
        </div>
      }
      error={
        <ErrorState
          variant="inline"
          title="Couldn’t load this conversation"
          onRetry={() => void contributions.refetch()}
        />
      }
    >
      {(data) => {
        const messages = data.contributions;
        const items = buildConversation(events, messages, detail.steps);

        return (
          <div className="flex min-h-0 flex-1 flex-col">
            <QueuedBanner run={detail.run} contributions={messages} />
            {degraded ? (
              <div
                aria-live="polite"
                className="border-b border-border-subtle px-6 py-2 text-xs text-danger"
              >
                Some events could not be decoded — this thread may be incomplete.
              </div>
            ) : null}
            {items.length === 0 && !working ? (
              <div className="px-6 py-8">
                <EmptyState
                  icon="loader"
                  variant="inline"
                  tone={state === "error" ? "error" : "neutral"}
                  title={state === "error" ? "This run's stream failed" : "Nothing here yet"}
                  description={
                    state === "error"
                      ? "Reconnect to see this run's activity."
                      : "Agent activity and your messages appear here as they happen."
                  }
                />
              </div>
            ) : (
              <div className="relative flex min-h-0 flex-1 flex-col">
                <div ref={autoscroll.viewportRef} className="min-h-0 flex-1 overflow-auto">
                  <div
                    ref={autoscroll.contentRef}
                    role="list"
                    aria-label="Run conversation"
                    className="py-1"
                  >
                    {items.map((item) => (
                      <ThreadItem key={item.key} item={item} runId={detail.run.id} />
                    ))}
                    {working ? <WorkingRow latest={events.at(-1) ?? null} /> : null}
                  </div>
                </div>
                {autoscroll.pinned ? null : <JumpToLatest onClick={autoscroll.jumpToLatest} />}
              </div>
            )}
            <ConversationComposer detail={detail} onSent={autoscroll.jumpToLatest} />
          </div>
        );
      }}
    </QueryBoundary>
  );
}
