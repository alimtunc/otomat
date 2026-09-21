import type { ConversationEntry } from "@otomat/domain";
import {
  cn,
  FOCUS_RING_INSET,
  Icon,
  IconButton,
  LiveDot,
  RelativeTime,
  StepStatusChip,
} from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { conversationLine } from "@web/lib/conversations/line";
import type { InboxMarkPatch } from "@web/lib/inbox/marks";
import type { KeyboardEvent } from "react";

export interface ConversationRowProps {
  entry: ConversationEntry;
  selected: boolean;
  pending: boolean;
  onMark: (patch: InboxMarkPatch) => void;
}

function runtimeModelLabel(participant: ConversationEntry["participant"]): string | null {
  if (participant === null) return null;
  return participant.model === null
    ? participant.runtime
    : `${participant.runtime} · ${participant.model}`;
}

export function ConversationRow({ entry, selected, pending, onMark }: ConversationRowProps) {
  const who = runtimeModelLabel(entry.participant);
  const onKeyDown = (event: KeyboardEvent<HTMLAnchorElement>): void => {
    if (event.key === "u") onMark({ read: !entry.read });
    else if (event.key === "e") onMark({ archived: true });
  };
  return (
    <div
      className={cn(
        "group flex items-start gap-1 rounded-md hover:bg-hover",
        selected && "bg-selected",
      )}
    >
      <Link
        to="/conversations"
        search={{ run: entry.run_id, step: entry.step_run_id }}
        replace
        aria-current={selected ? "true" : undefined}
        data-conversation-row
        onKeyDown={onKeyDown}
        className={`flex min-w-0 flex-1 gap-2 rounded-md px-2 py-1.5 ${FOCUS_RING_INSET}`}
      >
        <span className="flex h-5 w-3 shrink-0 items-center justify-center">
          <LiveDot tone="iris" size={6} className={entry.read ? "invisible" : undefined} />
          {entry.read ? null : <span className="sr-only">Unread</span>}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              className={cn(
                "min-w-0 truncate text-sm",
                entry.read ? "text-text-secondary" : "font-medium text-foreground",
              )}
            >
              {entry.step_name}
            </span>
            <StepStatusChip status={entry.step_status} showLabel={false} />
            <span className="ml-auto shrink-0 text-xs text-text-tertiary">
              <RelativeTime date={entry.updated_at} addSuffix={false} />
            </span>
          </span>
          <span className="flex min-w-0 items-center gap-2 text-xs">
            <span
              className={cn(
                "min-w-0 flex-1 truncate",
                entry.read ? "text-text-tertiary" : "text-text-secondary",
              )}
            >
              {conversationLine(entry)}
            </span>
            {who === null ? null : <span className="shrink-0 text-text-tertiary">{who}</span>}
          </span>
        </span>
      </Link>
      <span className="mr-1 flex shrink-0 items-center self-center opacity-0 focus-within:opacity-100 group-hover:opacity-100">
        <IconButton
          size="sm"
          label={entry.read ? "Mark as unread" : "Mark as read"}
          icon={<Icon name={entry.read ? "mail" : "mail-open"} aria-hidden />}
          disabled={pending}
          onClick={() => onMark({ read: !entry.read })}
        />
        <IconButton
          size="sm"
          label="Archive"
          icon={<Icon name="archive" aria-hidden />}
          disabled={pending}
          onClick={() => onMark({ archived: true })}
        />
      </span>
    </div>
  );
}
