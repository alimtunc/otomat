import type { ConversationThreadEntry as ConversationEntry } from "@otomat/domain";
import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  FOCUS_RING_INSET,
  Icon,
  IconButton,
  LiveDot,
  RelativeTime,
  StepStatusChip,
} from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { conversationLine } from "@web/lib/conversations/line";
import { conversationStatus } from "@web/lib/conversations/status";
import type { InboxMarkPatch } from "@web/lib/inbox/marks";
import type { KeyboardEvent } from "react";

export interface ConversationRowProps {
  entry: ConversationEntry;
  selected: boolean;
  pending: boolean;
  showIssue?: boolean;
  onMark: (patch: InboxMarkPatch) => void;
}

export function ConversationRow({
  entry,
  selected,
  pending,
  showIssue = false,
  onMark,
}: ConversationRowProps) {
  const isTerminal = "terminal" in entry;
  const title = isTerminal ? `${entry.terminal.tool ?? "Shell"} terminal` : entry.step_name;
  const kindLabel = isTerminal ? "Terminal" : "Cockpit · chat";
  const status = conversationStatus([entry]);
  const onKeyDown = (event: KeyboardEvent<HTMLAnchorElement>): void => {
    if (pending || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "u") onMark({ read: !entry.read });
    else if (event.key === "e") onMark({ archived: true });
  };
  return (
    <div
      className={cn(
        "flex items-start gap-1 rounded-md border-l-2",
        selected ? "border-l-iris bg-selected" : "border-l-transparent hover:bg-hover",
      )}
    >
      <Link
        to="/conversations"
        search={
          isTerminal
            ? { terminal: entry.terminal.id }
            : { run: entry.run_id, step: entry.step_run_id }
        }
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
          {showIssue ? (
            <span className="flex min-w-0 items-center gap-2 text-xs text-text-tertiary">
              <span className="truncate font-mono">
                {entry.issue?.identifier ?? entry.project.name}
              </span>
              <span className="ml-auto shrink-0">
                <RelativeTime date={entry.updated_at} addSuffix={false} />
              </span>
            </span>
          ) : null}
          <span className="flex min-w-0 items-center gap-1.5">
            <span title={kindLabel} aria-label={kindLabel} className="shrink-0 text-text-tertiary">
              <Icon name={isTerminal ? "terminal" : "monitor"} size="xs" aria-hidden />
            </span>
            <span
              className={cn(
                "min-w-0 truncate text-sm",
                entry.read ? "text-text-secondary" : "font-medium text-foreground",
              )}
            >
              {showIssue ? (entry.issue?.title ?? title) : title}
            </span>
            {showIssue ? null : (
              <span className="ml-auto shrink-0 text-xs text-text-tertiary">
                <RelativeTime date={entry.updated_at} addSuffix={false} />
              </span>
            )}
          </span>
          <span className="flex min-w-0 items-center gap-2 text-xs">
            {isTerminal ? (
              <span className="shrink-0 text-text-tertiary">
                {entry.terminal.state === "exited" ? "Ended" : "Active"}
              </span>
            ) : null}
            {status === null ? null : <StepStatusChip status={status} className="shrink-0" />}
            <span
              className={cn(
                "min-w-0 flex-1 truncate",
                entry.read ? "text-text-tertiary" : "text-text-secondary",
              )}
            >
              {conversationLine(entry)}
            </span>
          </span>
        </span>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={pending}
          render={
            <IconButton
              size="sm"
              label="Conversation actions"
              icon={<Icon name="more-horizontal" aria-hidden />}
              className="mr-1 self-center text-text-tertiary"
            />
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={pending} onClick={() => onMark({ read: !entry.read })}>
            {entry.read ? "Mark as unread" : "Mark as read"}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={pending} onClick={() => onMark({ archived: true })}>
            Archive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
