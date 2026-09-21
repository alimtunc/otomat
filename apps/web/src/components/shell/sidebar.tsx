import {
  AppSidebar,
  NavSection,
  ProjectSwitcher,
  SidebarNavItem,
  useSidebarCollapsed,
  type ProjectSummary,
} from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import {
  CONVERSATIONS_NAV,
  INBOX_NAV,
  SETTINGS_NAV,
  WORKSPACE_NAV,
  type ShellSection,
} from "@web/components/shell/nav-items";
import { projectTabsStore } from "@web/components/shell/project-tabs/store";
import type { ReactNode, Ref } from "react";

interface SidebarProps {
  active: ShellSection;
  projectTriggerRef?: Ref<HTMLButtonElement>;
  projects: ProjectSummary[];
  currentProjectId?: string;
  onProjectSelect: (id: string) => void;
  onAddProject?: () => void;
  onSearch: () => void;
  onNewIssue: () => void;
  hasLiveRun?: boolean;
  reviewCount?: number;
  inboxCount?: number;
  conversationCount?: number;
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
  projectTriggerRef,
  projects,
  currentProjectId,
  onProjectSelect,
  onAddProject,
  onSearch,
  onNewIssue,
  hasLiveRun = false,
  reviewCount = 0,
  inboxCount = 0,
  conversationCount = 0,
}: SidebarProps) {
  const collapsed = useSidebarCollapsed();
  const projectSwitcher = (
    <ProjectSwitcher
      projects={projects}
      triggerRef={projectTriggerRef}
      currentId={currentProjectId}
      onSelect={onProjectSelect}
      collapsed={collapsed}
      onOpenTab={projectTabsStore.actions.open}
      {...(onAddProject === undefined ? {} : { onAddProject })}
    />
  );
  const footer = (
    <>
      <SidebarNavItem
        icon={SETTINGS_NAV.icon}
        label={SETTINGS_NAV.label}
        active={active === SETTINGS_NAV.section}
        render={navRender(SETTINGS_NAV.to)}
        collapsed={collapsed}
      />
    </>
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
        <SidebarNavItem
          icon={CONVERSATIONS_NAV.icon}
          label={CONVERSATIONS_NAV.label}
          active={active === CONVERSATIONS_NAV.section}
          badgeCount={conversationCount > 0 ? conversationCount : undefined}
          render={navRender(CONVERSATIONS_NAV.to)}
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
