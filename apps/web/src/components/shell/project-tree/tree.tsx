import type { ConversationThreadEntry } from "@otomat/domain";
import { Badge, FOCUS_RING_INSET, Icon, LiveDot, type ProjectSummary } from "@otomat/ui";
import { useSelector } from "@tanstack/react-store";
import { arrangeProjects, withLayoutIcons } from "@web/components/shell/project-layout/arrange";
import { projectLayoutStore } from "@web/components/shell/project-layout/store";
import type { HostInboxEntries } from "@web/components/shell/project-tabs/use-open-host-inboxes";
import { useActiveHostId } from "@web/lib/active-host";
import { isConversationRunning } from "@web/lib/conversations/status";

import { attentionByProject, conversationsByProject } from "./by-project";
import { SidebarProject } from "./project";
import { useProjectShortcuts } from "./use-project-shortcuts";

export function ProjectTree({
  projects,
  currentProjectId,
  href,
  collapsed,
  entries,
  inboxes,
  onNavigate,
}: {
  projects: ProjectSummary[];
  currentProjectId?: string;
  href: string;
  collapsed: boolean;
  entries: ConversationThreadEntry[];
  inboxes: HostInboxEntries[];
  onNavigate: (id: string, href?: string) => void;
}) {
  const layout = useSelector(projectLayoutStore);
  const host = useActiveHostId();
  const sections = arrangeProjects(layout, withLayoutIcons(layout, projects));
  const attention = attentionByProject(inboxes);
  const byProject = conversationsByProject(entries, host);
  useProjectShortcuts(
    sections.flatMap((section) => section.items),
    currentProjectId,
    onNavigate,
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
          byProject.get(project.id)?.some(isConversationRunning),
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
                conversations={byProject.get(project.id) ?? []}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}
