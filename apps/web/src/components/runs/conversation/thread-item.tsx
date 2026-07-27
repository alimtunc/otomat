import { ActivityGroup } from "@web/components/runs/conversation/activity-group";
import { AgentMessage } from "@web/components/runs/conversation/agent-message";
import { LedgerEventRow } from "@web/components/runs/conversation/ledger-event-row";
import { ConversationMessage } from "@web/components/runs/conversation/message";
import type { ConversationItem } from "@web/lib/conversation";

export function ThreadItem({ item, runId }: { item: ConversationItem; runId: string }) {
  if (item.kind === "step") {
    return (
      <div
        role="listitem"
        className="px-6 pb-1 pt-3 text-micro font-semibold uppercase tracking-wide text-text-tertiary"
      >
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
  return <LedgerEventRow event={item.event} />;
}
