import type { ConversationThreadEntry } from "@otomat/domain";
import {
  Badge,
  cn,
  FOCUS_RING_INSET,
  Icon,
  IconButton,
  LiveDot,
  ProjectGlyph,
  SidebarNavItem,
  type ProjectSummary,
} from "@otomat/ui";
import { isConversationRunning } from "@web/lib/conversations/status";
import { conversationTitle } from "@web/lib/conversations/title";
import { useState } from "react";

export interface SidebarProjectProps {
  project: ProjectSummary;
  active: boolean;
  href: string;
  collapsed: boolean;
  conversations: ConversationThreadEntry[];
  attention: number | undefined;
  onNavigate: (id: string, href: string) => void;
}
export function SidebarProject({
  project,
  active,
  href,
  collapsed,
  conversations,
  attention,
  onNavigate,
}: SidebarProjectProps) {
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const open = expanded ?? active;
  const live = conversations.some(isConversationRunning);
  const visible = conversations.filter((entry) => !entry.archived).slice(0, 5);
  const projectLabel = `${project.name} · ${project.tag ?? "Local"}${attention ? ` · ${attention} unread` : ""}${live ? " · Running" : ""}`;
  return (
    <div className="min-w-0" data-project={project.id}>
      <div
        className={cn(
          "flex min-w-0 items-center rounded-md",
          active && "bg-selected",
          collapsed ? "justify-center" : "pr-1",
        )}
      >
        <button
          type="button"
          onClick={() => onNavigate(project.id, "/project")}
          title={projectLabel}
          aria-label={projectLabel}
          aria-current={active && href === "/project" ? "page" : undefined}
          className={cn(
            "relative flex h-10 min-w-0 items-center gap-2 rounded px-2 text-left text-sm",
            FOCUS_RING_INSET,
            collapsed ? "w-full justify-center" : "flex-1",
          )}
        >
          <ProjectGlyph name={project.name} icon={project.icon} />
          {collapsed ? null : (
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block truncate",
                  active ? "font-medium text-foreground" : "text-text-secondary",
                )}
              >
                {project.name}
              </span>
              <span className="block truncate text-micro text-text-tertiary">
                {project.tag ?? "Local"}
              </span>
            </span>
          )}
          {collapsed && (live || attention) ? (
            <span className="absolute right-0 top-1" aria-label={live ? "Running" : "Unread"}>
              <LiveDot size={6} tone={attention ? "warning" : "iris"} />
            </span>
          ) : null}
          {!collapsed && live ? <LiveDot size={6} tone="iris" /> : null}
          {!collapsed && attention ? <Badge variant="warning">{attention}</Badge> : null}
        </button>
        {collapsed ? null : (
          <IconButton
            size="sm"
            label={`${open ? "Collapse" : "Expand"} project ${project.name}`}
            aria-expanded={open}
            icon={<Icon name={open ? "chevron-down" : "chevron-right"} aria-hidden />}
            onClick={() => setExpanded(!open)}
          />
        )}
      </div>
      {!collapsed && open ? (
        <nav
          aria-label={`${project.name} views`}
          className="mb-2 ml-5 flex flex-col gap-1 border-l border-border-subtle py-1 pl-2"
        >
          <SidebarNavItem
            icon="list-todo"
            label="Issues"
            active={active && href.startsWith("/issues")}
            onClick={() => onNavigate(project.id, "/issues")}
          />
          <SidebarNavItem
            icon="activity"
            label="All runs"
            active={active && href.startsWith("/runs")}
            onClick={() => onNavigate(project.id, "/runs")}
          />
          {visible.length ? (
            <div className="px-2 pb-1 pt-3 text-micro text-text-tertiary">Conversations</div>
          ) : null}
          {visible.map((entry) => {
            const target = `/conversations?${new URLSearchParams(
              "terminal" in entry
                ? { terminal: entry.terminal.id }
                : { run: entry.run_id, step: entry.step_run_id },
            )}`;
            const title = conversationTitle(entry);
            return (
              <button
                key={entry.id}
                type="button"
                title={`${entry.issue?.title ?? project.name} · ${title}`}
                onClick={() => onNavigate(project.id, target)}
                aria-current={active && href === target ? "page" : undefined}
                className={cn(
                  "flex h-8 w-full min-w-0 items-center gap-2.5 rounded border-l-2 px-2 text-left text-sm",
                  FOCUS_RING_INSET,
                  active && href === target
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
                  <span className="ml-auto shrink-0 text-amber" aria-label="Unread">
                    ●
                  </span>
                )}
              </button>
            );
          })}
          {conversations.length > visible.length ? (
            <button
              type="button"
              className={`h-8 w-full rounded px-2 text-left text-xs text-text-tertiary hover:bg-hover ${FOCUS_RING_INSET}`}
              onClick={() => onNavigate(project.id, "/runs")}
            >
              All project activity
            </button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
