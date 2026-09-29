import { countUnreadConversations } from "@otomat/domain";
import {
  AppSidebar,
  ProjectSwitcher,
  SidebarNavItem,
  useSidebarCollapsed,
  type ProjectSummary,
} from "@otomat/ui";
import { Link, useRouterState } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import type { ConversationsQuery } from "@web/api/conversations/queries";
import {
  CONVERSATIONS_NAV,
  INBOX_NAV,
  PROJECT_HOME_NAV,
  PROJECT_SETTINGS_NAV,
  SETTINGS_NAV,
  type ShellSection,
} from "@web/components/shell/nav-items";
import { isDeskRoute } from "@web/components/shell/project-desk/state";
import { switcherSections } from "@web/components/shell/project-layout/arrange";
import { projectLayoutStore } from "@web/components/shell/project-layout/store";
import type { HostInboxEntries } from "@web/components/shell/project-tabs/use-open-host-inboxes";
import { ConversationsNotice } from "@web/components/shell/project-tree/conversations/notice";
import { ProjectTree } from "@web/components/shell/project-tree/tree";
import type { ReactNode, Ref } from "react";

interface SidebarProps {
  active: ShellSection | null;
  projectTriggerRef?: Ref<HTMLButtonElement>;
  projects: ProjectSummary[];
  currentProjectId?: string;
  onProjectSelect: (id: string, href?: string) => void;
  onAddProject?: () => void;
  onOrganizeProjects: () => void;
  onSearch: () => void;
  onNewIssue: () => void;
  inboxCount?: number;
  hostLabel: string;
  conversations: ConversationsQuery;
  inboxes: HostInboxEntries[];
}
function navRender(to: string) {
  return ({
    className,
    children,
    ...rest
  }: {
    className: string;
    children: ReactNode;
    "aria-current"?: "page";
  }) => (
    <Link to={to} className={className} {...rest}>
      {children}
    </Link>
  );
}
export function Sidebar({
  active,
  projectTriggerRef,
  projects,
  currentProjectId,
  onProjectSelect,
  onAddProject,
  onOrganizeProjects,
  onSearch,
  onNewIssue,
  inboxCount = 0,
  hostLabel,
  conversations,
  inboxes,
}: SidebarProps) {
  const collapsed = useSidebarCollapsed();
  const href = useRouterState({ select: (state) => state.location.href });
  const conversationCount = countUnreadConversations(conversations.data?.entries ?? []);
  const layout = useSelector(projectLayoutStore);
  return (
    <AppSidebar
      collapsed={collapsed}
      projectSwitcher={
        <ProjectSwitcher
          sections={switcherSections(layout, projects)}
          triggerRef={projectTriggerRef}
          currentId={currentProjectId}
          onSelect={(id) => onProjectSelect(id, PROJECT_HOME_NAV.to)}
          onOpenSettings={(id) => onProjectSelect(id, PROJECT_SETTINGS_NAV.to)}
          onOrganize={onOrganizeProjects}
          {...(onAddProject === undefined ? {} : { onAddProject })}
        />
      }
      footer={
        <>
          <SidebarNavItem
            icon={SETTINGS_NAV.icon}
            label={SETTINGS_NAV.label}
            active={active === SETTINGS_NAV.section}
            render={navRender(SETTINGS_NAV.to)}
            collapsed={collapsed}
          />
        </>
      }
    >
      {!collapsed ? (
        <div className="flex h-6 items-center justify-between px-4 text-micro text-text-tertiary">
          <span>Apps</span>
          <span className="ml-2 truncate" title={hostLabel}>
            {hostLabel}
          </span>
        </div>
      ) : (
        <div className="h-6" aria-hidden />
      )}
      <nav aria-label="Quick actions" className="flex flex-col gap-px px-2">
        <SidebarNavItem
          icon="search"
          label="Search"
          kbd="⌘K"
          onClick={onSearch}
          collapsed={collapsed}
        />
        <SidebarNavItem
          icon="plus"
          label="New issue"
          kbd="C"
          onClick={onNewIssue}
          collapsed={collapsed}
        />
        <SidebarNavItem
          icon={INBOX_NAV.icon}
          label={INBOX_NAV.label}
          active={active === INBOX_NAV.section}
          badgeCount={inboxCount || undefined}
          render={navRender(INBOX_NAV.to)}
          collapsed={collapsed}
        />
        <SidebarNavItem
          icon={CONVERSATIONS_NAV.icon}
          label={CONVERSATIONS_NAV.label}
          active={active === CONVERSATIONS_NAV.section && !isDeskRoute(href)}
          badgeCount={conversationCount || undefined}
          render={navRender(CONVERSATIONS_NAV.to)}
          collapsed={collapsed}
        />
      </nav>
      <div className="mx-3 my-3 border-t border-border-subtle" />
      <div className="flex h-6 items-center px-4 text-micro text-text-tertiary">
        {collapsed ? null : "Projects"}
      </div>
      <ConversationsNotice query={conversations} collapsed={collapsed} />
      <ProjectTree
        projects={projects}
        currentProjectId={currentProjectId}
        href={href}
        collapsed={collapsed}
        entries={conversations.data?.entries ?? []}
        inboxes={inboxes}
        onNavigate={onProjectSelect}
      />
    </AppSidebar>
  );
}
