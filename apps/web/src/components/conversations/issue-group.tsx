import { cn, FOCUS_RING_INSET, Icon, IssueStatusChip, LiveDot } from "@otomat/ui";
import { CountBadge } from "@web/components/issues/count-badge";
import { IssueLabel } from "@web/components/issues/issue-label";
import type { ConversationIssueGroup } from "@web/lib/conversations/sections";
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
  return (
    <li className="flex flex-col">
      <h3>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={rowsId}
          onClick={onToggle}
          className={`relative flex h-8 w-full items-center gap-1.5 rounded-md px-2 text-sm hover:bg-hover ${FOCUS_RING_INSET}`}
        >
          <Icon
            name="chevron-down"
            size="xs"
            aria-hidden
            className={cn("shrink-0 text-text-tertiary", collapsed && "-rotate-90")}
          />
          {group.issue.cycle === null ? null : (
            <IssueStatusChip status={group.issue.cycle} showLabel={false} />
          )}
          <IssueLabel
            identifier={group.issue.identifier}
            title={group.issue.title}
            className={cn(
              "flex-1 text-left",
              unread ? "font-medium text-foreground" : "text-text-secondary",
            )}
          />
          {unread && collapsed ? (
            <>
              <LiveDot tone="iris" size={6} />
              <span className="sr-only">Unread</span>
            </>
          ) : null}
          <CountBadge count={group.entries.length} tone="neutral" />
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
