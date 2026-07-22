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
import {
  CONFIGURE_NAV,
  INBOX_NAV,
  WORKSPACE_NAV,
  type ShellSection,
} from "@web/components/shell/nav-items";
import type { ReactNode } from "react";

interface SidebarProps {
  active: ShellSection;
  online: boolean;
  daemonVersion?: string;
  projects: ProjectSummary[];
  currentProjectId?: string;
  onProjectSelect: (id: string) => void;
  onSearch: () => void;
  onNewIssue: () => void;
  hasLiveRun?: boolean;
  reviewCount?: number;
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
  projects,
  currentProjectId,
  onProjectSelect,
  onSearch,
  onNewIssue,
  hasLiveRun = false,
  reviewCount = 0,
}: SidebarProps) {
  const collapsed = useSidebarCollapsed();
  const projectSwitcher = (
    <ProjectSwitcher
      projects={projects}
      currentId={currentProjectId}
      onSelect={onProjectSelect}
      collapsed={collapsed}
    />
  );
  const footer = (
    <SidebarDaemonStatus
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
      <NavSection label="Configure" collapsed={collapsed}>
        {CONFIGURE_NAV.map((item) => (
          <SidebarNavItem
            key={item.section}
            icon={item.icon}
            label={item.label}
            active={active === item.section}
            render={navRender(item.to)}
            collapsed={collapsed}
          />
        ))}
      </NavSection>
      <NavSection label="Reference" collapsed={collapsed}>
        <SidebarNavItem
          icon="layers"
          label="Design system"
          href="/gallery.html"
          collapsed={collapsed}
        />
      </NavSection>
    </AppSidebar>
  );
}
