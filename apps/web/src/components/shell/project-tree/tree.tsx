import { countUnreadInboxEntriesByProject, type ConversationThreadEntry } from "@otomat/domain";
import { Badge, FOCUS_RING_INSET, Icon, LiveDot, type ProjectSummary } from "@otomat/ui";
import { useSelector } from "@tanstack/react-store";
import { arrangeProjects, withLayoutIcons } from "@web/components/shell/project-layout/arrange";
import { projectLayoutStore } from "@web/components/shell/project-layout/store";
import { projectSwitcherKey } from "@web/components/shell/project-selection/host-key";
import type { HostInboxEntries } from "@web/components/shell/project-tabs/use-open-host-inboxes";
import { isConversationRunning } from "@web/lib/conversations/status";

import { SidebarProject } from "./project";

export function ProjectTree({
  projects,
  currentProjectId,
  href,
  collapsed,
  entries,
  host,
  inboxes,
  onNavigate,
}: {
  projects: ProjectSummary[];
  currentProjectId?: string;
  href: string;
  collapsed: boolean;
  entries: ConversationThreadEntry[];
  host: string;
  inboxes: HostInboxEntries[];
  onNavigate: (id: string, href: string) => void;
}) {
  const layout = useSelector(projectLayoutStore);
  const sections = arrangeProjects(layout, withLayoutIcons(layout, projects));
  const attention = new Map(
    inboxes.flatMap((inbox) =>
      [...countUnreadInboxEntriesByProject(inbox.entries)].map(
        ([id, count]) => [projectSwitcherKey(inbox.host, id), count] as const,
      ),
    ),
  );
  return (
    <div className="flex flex-col gap-2 px-2 pb-3">
      {sections.map(({ group, items }) => {
        const shown = group?.collapsed
          ? items.filter((project) => project.id === currentProjectId)
          : items;
        const hidden = items.filter((project) => !shown.includes(project));
        const unread = hidden.reduce((sum, project) => sum + (attention.get(project.id) ?? 0), 0);
        const live = hidden.some((project) =>
          entries.some(
            (entry) => `${host}:${entry.project.id}` === project.id && isConversationRunning(entry),
          ),
        );
        return (
          <section key={group?.id ?? "ungrouped"} aria-label={group?.name ?? "Ungrouped"}>
            {group && !collapsed ? (
              <button
                type="button"
                aria-expanded={!group.collapsed}
                onClick={() => projectLayoutStore.actions.toggleGroup(group.id)}
                className={`flex w-full min-w-0 items-center gap-1.5 rounded px-1 py-2 text-xs text-text-tertiary ${FOCUS_RING_INSET}`}
              >
                <Icon
                  name={group.collapsed ? "chevron-right" : "chevron-down"}
                  className="size-3 shrink-0"
                  aria-hidden
                />
                <span className="truncate">{group.name}</span>
                <span className="ml-auto">{items.length}</span>
                {live ? <LiveDot tone="iris" size={6} /> : null}
                {unread ? <Badge variant="warning">{unread}</Badge> : null}
              </button>
            ) : null}
            {(collapsed ? items : shown).map((project) => (
              <SidebarProject
                key={project.id}
                project={project}
                active={project.id === currentProjectId}
                href={href}
                collapsed={collapsed}
                onNavigate={onNavigate}
                attention={attention.get(project.id)}
                conversations={entries.filter(
                  (entry) => `${host}:${entry.project.id}` === project.id,
                )}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}
