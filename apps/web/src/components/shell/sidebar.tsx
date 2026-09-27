import type { ConversationThreadEntry } from "@otomat/domain";
import {
  AppSidebar,
  HostTag,
  Icon,
  ProjectSwitcher,
  SidebarNavItem,
  useSidebarCollapsed,
  type ProjectSummary,
} from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import {
  CONVERSATIONS_NAV,
  INBOX_NAV,
  SETTINGS_NAV,
  type ShellSection,
} from "@web/components/shell/nav-items";
import { switcherSections } from "@web/components/shell/project-layout/arrange";
import { projectLayoutStore } from "@web/components/shell/project-layout/store";
import type { HostInboxEntries } from "@web/components/shell/project-tabs/use-open-host-inboxes";
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
  conversationCount?: number;
  hostLabel: string;
  hostId: string;
  href: string;
  conversations: ConversationThreadEntry[];
  inboxes: HostInboxEntries[];
  notice?: ReactNode;
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
    <Link to={to} search={{}} className={className} {...rest}>
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
  conversationCount = 0,
  hostLabel,
  hostId,
  href,
  conversations,
  inboxes,
  notice,
}: SidebarProps) {
  const collapsed = useSidebarCollapsed();
  const layout = useSelector(projectLayoutStore);
  return (
    <AppSidebar
      collapsed={collapsed}
      projectSwitcher={
        <ProjectSwitcher
          sections={switcherSections(layout, projects)}
          triggerRef={projectTriggerRef}
          currentId={currentProjectId}
          onSelect={(id) => onProjectSelect(id, "/project")}
          onOpenSettings={(id) => onProjectSelect(id, "/settings/project")}
          collapsed={collapsed}
          onOrganize={onOrganizeProjects}
          {...(onAddProject === undefined ? {} : { onAddProject })}
        />
      }
      footer={
        <>
          <SidebarNavItem
            icon={SETTINGS_NAV.icon}
            label={SETTINGS_NAV.label}
            active={active === "settings"}
            render={navRender(SETTINGS_NAV.to)}
            collapsed={collapsed}
          />
          <Link
            to="/settings/host"
            className="flex min-w-0 items-center justify-center py-2"
            title={`Host · ${hostLabel}`}
          >
            <HostTag tag={hostLabel} />
          </Link>
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
          active={active === "inbox"}
          badgeCount={inboxCount || undefined}
          render={navRender(INBOX_NAV.to)}
          collapsed={collapsed}
        />
        <SidebarNavItem
          icon={CONVERSATIONS_NAV.icon}
          label={CONVERSATIONS_NAV.label}
          active={
            active === "conversations" && !href.includes("run=") && !href.includes("terminal=")
          }
          badgeCount={conversationCount || undefined}
          render={navRender(CONVERSATIONS_NAV.to)}
          collapsed={collapsed}
        />
      </nav>
      <div className="mx-3 my-3 border-t border-border-subtle" />
      <div className="flex h-6 items-center px-4 text-micro text-text-tertiary">
        {collapsed ? null : "Projects"}
      </div>
      {notice ? (
        <div className="flex min-h-8 min-w-0 items-center">
          {collapsed ? (
            <span
              role="status"
              aria-label="Conversations unavailable"
              title="Conversations unavailable"
              className="mx-auto flex h-8 items-center text-warning"
            >
              <Icon name="alert-triangle" className="size-4" aria-hidden />
            </span>
          ) : (
            notice
          )}
        </div>
      ) : null}
      <ProjectTree
        projects={projects}
        currentProjectId={currentProjectId}
        href={href}
        collapsed={collapsed}
        entries={conversations}
        host={hostId}
        inboxes={inboxes}
        onNavigate={onProjectSelect}
      />
    </AppSidebar>
  );
}
