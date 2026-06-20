import {
  AppShell,
  AppSidebar,
  Breadcrumbs,
  ConnectionStatusIndicator,
  NavSection,
  OfflineBanner,
  ProjectSwitcher,
  SidebarDaemonStatus,
  SidebarNavItem,
  Topbar,
  useTheme,
  type BreadcrumbItem,
  type ProjectSummary,
} from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { CircleDot, ListTodo, Settings } from "lucide-react";
import type { ReactNode } from "react";

import { useDaemonStatus, useProjects } from "../lib/queries";

export interface RouteShellProps {
  breadcrumbs: BreadcrumbItem[];
  active: "issues" | "runs" | "settings";
  actions?: ReactNode;
  rightPanel?: ReactNode;
  children: ReactNode;
}

function Sidebar({
  active,
  online,
  projects,
}: {
  active: RouteShellProps["active"];
  online: boolean;
  projects: ProjectSummary[];
}) {
  const projectSwitcher = <ProjectSwitcher projects={projects} onSelect={() => {}} />;
  return (
    <AppSidebar projectSwitcher={projectSwitcher} footer={<SidebarDaemonStatus online={online} />}>
      <NavSection label="Workspace">
        <SidebarNavItem
          icon={ListTodo}
          label="Issues"
          active={active === "issues"}
          render={({ className, children, ...rest }) => (
            <Link to="/issues" className={className} {...rest}>
              {children}
            </Link>
          )}
        />
        <SidebarNavItem
          icon={CircleDot}
          label="Runs"
          active={active === "runs"}
          render={({ className, children, ...rest }) => (
            <Link to="/issues" className={className} {...rest}>
              {children}
            </Link>
          )}
        />
      </NavSection>
      <NavSection label="Configure">
        <SidebarNavItem
          icon={Settings}
          label="Settings"
          active={active === "settings"}
          render={({ className, children, ...rest }) => (
            <Link to="/settings/repositories" className={className} {...rest}>
              {children}
            </Link>
          )}
        />
      </NavSection>
    </AppSidebar>
  );
}

export function RouteShell({
  breadcrumbs,
  active,
  actions,
  rightPanel,
  children,
}: RouteShellProps) {
  const { density } = useTheme();
  const { connectionState, lastSyncAt, retry } = useDaemonStatus();
  const projectsQuery = useProjects();
  const projects: ProjectSummary[] = (projectsQuery.data ?? []).map((project) => ({
    id: project.id,
    name: project.name,
  }));

  const topbar = (
    <Topbar
      breadcrumbs={
        <Breadcrumbs
          items={breadcrumbs}
          renderLink={(item, label) => (
            <Link
              to={item.href as string}
              className="truncate hover:text-foreground focus-visible:outline-none focus-visible:[outline:2px_solid_var(--iris-ring)] focus-visible:rounded-sm"
            >
              {label}
            </Link>
          )}
        />
      }
      connectionStatus={
        <ConnectionStatusIndicator
          state={connectionState}
          lastSyncAt={lastSyncAt}
          onRetry={retry}
        />
      }
      actions={actions}
    />
  );

  return (
    <AppShell
      density={density}
      connectionState={connectionState}
      sidebar={
        <Sidebar active={active} online={connectionState === "online"} projects={projects} />
      }
      rightPanel={rightPanel}
      topbar={topbar}
    >
      {connectionState === "offline" ? (
        <OfflineBanner message="Daemon unreachable — live data and actions are unavailable until it reconnects." />
      ) : null}
      {children}
    </AppShell>
  );
}
