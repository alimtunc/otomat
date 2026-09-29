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
import { PROJECT_HOME_NAV } from "@web/components/shell/nav-items";
import { isConversationRunning } from "@web/lib/conversations/status";
import { useState } from "react";

import { SidebarConversations } from "./conversations/list";

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
  const disclosed = expanded ?? active;
  const live = conversations.some(isConversationRunning);
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
          onClick={() => onNavigate(project.id, PROJECT_HOME_NAV.to)}
          title={projectLabel}
          aria-label={projectLabel}
          aria-current={active && href === PROJECT_HOME_NAV.to ? "page" : undefined}
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
            <span className="absolute right-0 top-1">
              <LiveDot size={6} tone={attention ? "warning" : "iris"} />
              <span className="sr-only">{live ? "Running" : "Unread"}</span>
            </span>
          ) : null}
          {!collapsed && live ? <LiveDot size={6} tone="iris" /> : null}
          {!collapsed && attention ? <Badge variant="warning">{attention}</Badge> : null}
        </button>
        {collapsed ? null : (
          <IconButton
            size="sm"
            label={`${disclosed ? "Collapse" : "Expand"} project ${project.name}`}
            aria-expanded={disclosed}
            icon={<Icon name={disclosed ? "chevron-down" : "chevron-right"} aria-hidden />}
            onClick={() => setExpanded(!disclosed)}
          />
        )}
      </div>
      {!collapsed && disclosed ? (
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
          <SidebarConversations
            entries={conversations.filter((entry) => !entry.archived)}
            href={active ? href : null}
            onNavigate={(target) => onNavigate(project.id, target)}
          />
        </nav>
      ) : null}
    </div>
  );
}
