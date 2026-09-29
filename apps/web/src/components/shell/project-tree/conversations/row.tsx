import type { ConversationThreadEntry } from "@otomat/domain";
import { cn, FOCUS_RING_INSET, Icon, LiveDot, StepStatusChip } from "@otomat/ui";
import { conversationStatus, isConversationRunning } from "@web/lib/conversations/status";
import { conversationTitle } from "@web/lib/conversations/title";

export function SidebarConversationRow({
  entry,
  selected,
  onSelect,
}: {
  entry: ConversationThreadEntry;
  selected: boolean;
  onSelect: () => void;
}) {
  const status = conversationStatus([entry]);
  let marker = (
    <Icon
      name={"terminal" in entry ? "terminal" : "message-square"}
      className="size-4"
      aria-hidden
    />
  );
  if (status !== null) marker = <StepStatusChip status={status} showLabel={false} />;
  else if (isConversationRunning(entry)) marker = <LiveDot tone="iris" size={6} />;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "page" : undefined}
      className={cn(
        "flex h-8 w-full min-w-0 items-center gap-2 rounded border-l-2 px-1.5 text-left text-sm",
        FOCUS_RING_INSET,
        selected
          ? "border-iris bg-selected text-foreground"
          : "border-transparent text-text-secondary hover:bg-hover",
      )}
    >
      <span className="flex w-6 shrink-0 justify-center">{marker}</span>
      <span className="truncate">{conversationTitle(entry)}</span>
      {entry.read ? null : (
        <span className="ml-auto flex shrink-0 items-center">
          <LiveDot tone="warning" size={6} />
          <span className="sr-only">Unread</span>
        </span>
      )}
    </button>
  );
}
