import {
  AppSidebar,
  NavSection,
  ProjectSwitcher,
  SidebarDaemonStatus,
  SidebarNavItem,
  useSidebarCollapsed,
  type ProjectSummary,
} from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { INBOX_NAV, WORKSPACE_NAV, type ShellSection } from "@web/components/shell/nav-items";
import type { ReactNode } from "react";

interface SidebarProps {
  active: ShellSection;
  online: boolean;
  daemonVersion?: string;
  /** SSH alias of the active remote execution host; absent when running against the local daemon. */
  hostAlias?: string;
  projects: ProjectSummary[];
  currentProjectId?: string;
  onProjectSelect: (id: string) => void;
  onAddProject?: () => void;
  onOpenSettings: () => void;
  onSearch: () => void;
  onNewIssue: () => void;
  hasLiveRun?: boolean;
  reviewCount?: number;
  inboxCount?: number;
}

function navRender(to: string) {
  return function render({
    className,
    children,
    ...rest
  }: {
    className: string;
    children: ReactNode;
    "aria-current"?: "page";
  }) {
    return (
      <Link to={to} className={className} {...rest}>
        {children}
      </Link>
    );
  };
}

export function Sidebar({
  active,
  online,
  daemonVersion,
  hostAlias,
  projects,
  currentProjectId,
  onProjectSelect,
  onAddProject,
  onOpenSettings,
  onSearch,
  onNewIssue,
  hasLiveRun = false,
  reviewCount = 0,
  inboxCount = 0,
}: SidebarProps) {
  const collapsed = useSidebarCollapsed();
  const projectSwitcher = (
    <ProjectSwitcher
      projects={projects}
      currentId={currentProjectId}
      onSelect={onProjectSelect}
      collapsed={collapsed}
      onOpenSettings={onOpenSettings}
      {...(onAddProject === undefined ? {} : { onAddProject })}
    />
  );
  const footer = (
    <SidebarDaemonStatus
      daemonId={hostAlias}
      online={online}
      version={daemonVersion && `v${daemonVersion}`}
      collapsed={collapsed}
    />
  );
  return (
    <AppSidebar projectSwitcher={projectSwitcher} footer={footer} collapsed={collapsed}>
      <nav aria-label="Quick actions" className="mt-1 flex flex-col gap-px px-2">
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
          badgeCount={inboxCount > 0 ? inboxCount : undefined}
          render={navRender(INBOX_NAV.to)}
          collapsed={collapsed}
        />
      </nav>
      <NavSection label="Workspace" collapsed={collapsed}>
        {WORKSPACE_NAV.map((item) => (
          <SidebarNavItem
            key={item.section}
            icon={item.icon}
            label={item.label}
            active={active === item.section}
            live={item.section === "runs" && hasLiveRun}
            badgeCount={item.section === "reviews" && reviewCount > 0 ? reviewCount : undefined}
            render={navRender(item.to)}
            collapsed={collapsed}
          />
        ))}
      </NavSection>
    </AppSidebar>
  );
}
