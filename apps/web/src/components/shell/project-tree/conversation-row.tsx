import type { ConversationThreadEntry } from "@otomat/domain";
import { cn, FOCUS_RING_INSET, Icon, LiveDot } from "@otomat/ui";
import { isConversationRunning } from "@web/lib/conversations/status";
import { conversationTitle } from "@web/lib/conversations/title";

export function SidebarConversationRow({
  entry,
  projectName,
  href,
  onSelect,
}: {
  entry: ConversationThreadEntry;
  projectName: string;
  href: string | null;
  onSelect: (target: string) => void;
}) {
  const target = `/conversations?${new URLSearchParams(
    "terminal" in entry
      ? { terminal: entry.terminal.id }
      : { run: entry.run_id, step: entry.step_run_id },
  )}`;
  const title = conversationTitle(entry);
  const selected = href === target;
  return (
    <button
      type="button"
      title={`${entry.issue?.title ?? projectName} · ${title}`}
      onClick={() => onSelect(target)}
      aria-current={selected ? "page" : undefined}
      className={cn(
        "flex h-8 w-full min-w-0 items-center gap-2.5 rounded border-l-2 px-2 text-left text-sm",
        FOCUS_RING_INSET,
        selected
          ? "border-iris bg-selected text-foreground"
          : "border-transparent text-text-secondary hover:bg-hover",
      )}
    >
      <span className="flex w-4 shrink-0 justify-center">
        {isConversationRunning(entry) ? (
          <LiveDot tone="iris" size={6} />
        ) : (
          <Icon
            name={"terminal" in entry ? "terminal" : "message-square"}
            className="size-4"
            aria-hidden
          />
        )}
      </span>
      <span className="truncate">{title}</span>
      {entry.read ? null : (
        <span className="ml-auto flex shrink-0 items-center">
          <LiveDot tone="warning" size={6} />
          <span className="sr-only">Unread</span>
        </span>
      )}
    </button>
  );
}
