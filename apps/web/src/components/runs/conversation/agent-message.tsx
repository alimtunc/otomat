import type { EventEnvelope } from "@otomat/domain";
import { AgentAvatar, RelativeTime } from "@otomat/ui";

/** What the agent actually said, straight from a `runtime.message` the provider emitted. */
export function AgentMessage({ event, text }: { event: EventEnvelope; text: string }) {
  return (
    <div role="listitem" className="flex flex-col gap-1.5 px-6 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <AgentAvatar name={event.source} size="sm" />
        <span className="text-xs font-semibold text-text-secondary">Agent</span>
        <RelativeTime date={event.occurred_at} className="text-xs" />
      </div>
      <p className="whitespace-pre-wrap rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-text-primary">
        {text}
      </p>
    </div>
  );
}
