import {
  cn,
  FOCUS_RING_INSET,
  Icon,
  LiveDot,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@otomat/ui";
import type { ConversationGroup } from "@web/lib/conversations/sections";
import { isConversationRunning } from "@web/lib/conversations/status";
import { type ReactNode, useId } from "react";

export interface SidebarConversationGroupProps {
  group: ConversationGroup;
  selected: boolean;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function SidebarConversationGroup({
  group,
  selected,
  collapsed,
  onToggle,
  children,
}: SidebarConversationGroupProps) {
  const rowsId = useId();
  const { issue } = group;
  const title = issue?.title ?? `${group.project.name} · no issue`;
  const identifier = issue?.identifier ?? null;
  const live = collapsed && group.entries.some(isConversationRunning);
  const unread = collapsed && group.entries.some((entry) => !entry.read);
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-expanded={!collapsed}
              aria-controls={rowsId}
              onClick={onToggle}
              className={cn(
                "flex h-8 w-full min-w-0 items-center gap-1.5 rounded border-l-2 px-1.5 text-left text-sm",
                FOCUS_RING_INSET,
                collapsed && selected
                  ? "border-iris bg-selected text-foreground"
                  : "border-transparent text-text-secondary hover:bg-hover",
              )}
            >
              <Icon
                name="chevron-down"
                size="xs"
                aria-hidden
                className={cn("shrink-0 text-text-tertiary", collapsed && "-rotate-90")}
              />
              {identifier === null ? null : (
                <span className="shrink-0 font-mono text-xs text-text-tertiary">{identifier}</span>
              )}
              <span className="min-w-0 flex-1 truncate">{title}</span>
              {live ? (
                <>
                  <LiveDot tone="iris" size={6} />
                  <span className="sr-only">Running</span>
                </>
              ) : null}
              {unread ? (
                <>
                  <LiveDot tone="warning" size={6} />
                  <span className="sr-only">Unread</span>
                </>
              ) : null}
              {collapsed && selected ? (
                <span className="sr-only">Holds the open conversation</span>
              ) : null}
            </button>
          }
        />
        <TooltipContent side="right">
          {identifier === null ? title : `${identifier} · ${title}`}
        </TooltipContent>
      </Tooltip>
      {collapsed ? null : (
        <div id={rowsId} className="flex flex-col gap-0.5 pl-3">
          {children}
        </div>
      )}
    </div>
  );
}
