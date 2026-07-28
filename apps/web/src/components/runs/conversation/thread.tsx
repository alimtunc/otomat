import { isRunWorking, type EventEnvelope, type RunDetail } from "@otomat/domain";
import { EmptyState, ErrorState, Skeleton } from "@otomat/ui";
import { useRunContributions } from "@web/api/runs/queries";
import type { RunStreamState } from "@web/api/runs/run-event-stream";
import { ConversationComposer } from "@web/components/runs/conversation/composer";
import { QueuedBanner } from "@web/components/runs/conversation/queued-banner";
import { ThreadItem } from "@web/components/runs/conversation/thread-item";
import { WorkingRow } from "@web/components/runs/conversation/working-row";
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

  if (contributions.isPending) {
    return (
      <div className="flex flex-col gap-2 p-6">
        <Skeleton height={14} width="55%" />
        <Skeleton height={14} width="35%" />
      </div>
    );
  }

  if (contributions.isError) {
    return (
      <ErrorState
        variant="inline"
        title="Couldn’t load this conversation"
        onRetry={() => void contributions.refetch()}
      />
    );
  }

  const messages = contributions.data.contributions;
  const items = buildConversation(events, messages, detail.steps);
  const working = isRunWorking(detail.run.status);

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
        <div
          role="list"
          aria-label="Run conversation"
          className="min-h-0 flex-1 overflow-auto py-1"
        >
          {items.map((item) => (
            <ThreadItem key={item.key} item={item} runId={detail.run.id} />
          ))}
          {working ? <WorkingRow latest={events.at(-1) ?? null} /> : null}
        </div>
      )}
      <ConversationComposer detail={detail} />
    </div>
  );
}
