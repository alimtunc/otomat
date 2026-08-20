import type { EventEnvelope } from "@otomat/domain";
import { AgentAvatar, CopyButton, Markdown, RelativeTime } from "@otomat/ui";

/** What the agent actually said, straight from a `runtime.message` the provider emitted.
    Copy raw text stays next to it because diagnostics need the unrendered source. */
export function AgentMessage({ event, text }: { event: EventEnvelope; text: string }) {
  return (
    <li className="flex flex-col gap-1.5 px-6 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <AgentAvatar name={event.source} size="sm" />
        <span className="text-xs font-semibold text-text-secondary">Agent</span>
        <RelativeTime date={event.occurred_at} className="text-xs" />
        <CopyButton value={text} label="Copy raw text" className="ml-auto" />
      </div>
      <Markdown
        value={text}
        className="rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm"
      />
    </li>
  );
}
