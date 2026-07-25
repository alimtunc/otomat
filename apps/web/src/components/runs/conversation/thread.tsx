import type { EventEnvelope, RunDetail } from "@otomat/domain";
import { EmptyState, TimelineEventRow } from "@otomat/ui";
import { useRunContributions } from "@web/api/runs/queries";
import type { RunStreamState } from "@web/api/runs/run-events-provider";
import { ActivityGroup } from "@web/components/runs/conversation/activity-group";
import { AgentMessage } from "@web/components/runs/conversation/agent-message";
import { ConversationComposer } from "@web/components/runs/conversation/composer";
import { ConversationMessage } from "@web/components/runs/conversation/message";
import { QueuedBanner } from "@web/components/runs/conversation/queued-banner";
import { WorkingRow } from "@web/components/runs/conversation/working-row";
import { eventDetail } from "@web/components/runs/timeline/event-detail/event-detail";
import { eventSummary } from "@web/components/runs/timeline/event-summary";
import { buildConversation, type ConversationItem } from "@web/lib/conversation";
import { isRunWorking } from "@web/lib/run-activity";

function ThreadItem({ item, runId }: { item: ConversationItem; runId: string }) {
  if (item.kind === "step") {
    return (
      <div className="px-6 pb-1 pt-3 text-micro font-semibold uppercase tracking-wide text-text-tertiary">
        {item.name}
      </div>
    );
  }
  if (item.kind === "message") {
    return <ConversationMessage runId={runId} contribution={item.contribution} />;
  }
  if (item.kind === "agent") {
    return <AgentMessage event={item.event} text={item.text} />;
  }
  if (item.kind === "activity") {
    return <ActivityGroup events={item.events} counts={item.counts} />;
  }
  return (
    <TimelineEventRow
      id={`event-${item.event.seq}`}
      type={item.event.type}
      provenance={item.event.source}
      summary={eventSummary(item.event)}
      at={item.event.occurred_at}
    >
      {eventDetail(item.event)}
    </TimelineEventRow>
  );
}

/**
 * One run's conversation, followed by a composer scoped to that run: the user's
 * messages, the agent's replies and the milestones that carry proof, with the
 * tool/log traffic between them folded into collapsed groups. Ordering comes
 * from the ledger, delivery state from the contributions read model.
 */
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
  const items = buildConversation(events, contributions.data?.contributions ?? [], detail.steps);
  const working = isRunWorking(detail.run);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <QueuedBanner run={detail.run} contributions={contributions.data?.contributions ?? []} />
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
