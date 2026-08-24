import { ActivityGroup } from "@web/components/runs/conversation/activity-group";
import { AgentMessage } from "@web/components/runs/conversation/agent-message";
import { InteractionCard } from "@web/components/runs/conversation/interaction-card";
import { LedgerEventRow } from "@web/components/runs/conversation/ledger-event-row";
import { ConversationMessage } from "@web/components/runs/conversation/message";
import type { ConversationItem } from "@web/lib/conversation";

export function ThreadItem({ item, runId }: { item: ConversationItem; runId: string }) {
  if (item.kind === "step") {
    return (
      <li className="px-6 pb-1 pt-3 text-micro font-semibold uppercase tracking-wide text-text-tertiary">
        {item.name}
      </li>
    );
  }
  if (item.kind === "message") {
    return <ConversationMessage runId={runId} contribution={item.contribution} />;
  }
  if (item.kind === "interaction") {
    return <InteractionCard runId={runId} interaction={item.interaction} />;
  }
  if (item.kind === "agent") {
    return <AgentMessage event={item.event} text={item.text} />;
  }
  if (item.kind === "activity") {
    return <ActivityGroup events={item.events} counts={item.counts} />;
  }
  return (
    <li>
      <LedgerEventRow event={item.event} />
    </li>
  );
}
