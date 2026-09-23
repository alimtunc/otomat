import { cn, FOCUS_RING_INSET, Icon, LiveDot, StepStatusChip } from "@otomat/ui";
import type { ConversationIssueGroup } from "@web/lib/conversations/sections";
import { conversationStatus } from "@web/lib/conversations/status";
import { type ReactNode, useId } from "react";

export interface ConversationIssueGroupItemProps {
  group: ConversationIssueGroup;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function ConversationIssueGroupItem({
  group,
  collapsed,
  onToggle,
  children,
}: ConversationIssueGroupItemProps) {
  const rowsId = useId();
  const unread = group.entries.some((entry) => !entry.read);
  const status = conversationStatus(group.entries);
  return (
    <li className="flex flex-col">
      <h3>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={rowsId}
          onClick={onToggle}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-hover ${FOCUS_RING_INSET}`}
        >
          <Icon
            name="chevron-down"
            size="xs"
            aria-hidden
            className={cn("shrink-0 text-text-tertiary", collapsed && "-rotate-90")}
          />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span
              className={cn(
                "truncate text-sm",
                unread ? "font-medium text-foreground" : "text-text-secondary",
              )}
            >
              {group.issue.title}
            </span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-tertiary">
              <span className="font-mono">{group.issue.identifier}</span>
              <span>{group.entries.length} conversations</span>
              {status === null ? null : <StepStatusChip status={status} />}
            </span>
          </span>
          {unread && collapsed ? (
            <>
              <LiveDot tone="iris" size={6} />
              <span className="sr-only">Unread</span>
            </>
          ) : null}
        </button>
      </h3>
      {collapsed ? null : (
        <ul id={rowsId} className="flex flex-col gap-0.5 pl-3">
          {children}
        </ul>
      )}
    </li>
  );
}
