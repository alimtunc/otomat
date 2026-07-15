import {
  AppShell,
  Breadcrumbs,
  ConnectionStatusIndicator,
  OfflineBanner,
  Topbar,
  useTheme,
  type BreadcrumbItem,
  type ProjectSummary,
} from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { useDaemonStatus, useProjects } from "@web/api/daemon/queries";
import { Sidebar, type ShellSection } from "@web/components/shell/sidebar";
import { useProjectSelection } from "@web/components/shell/use-project-selection";
import type { ReactNode } from "react";

export interface RouteShellProps {
  breadcrumbs: BreadcrumbItem[];
  active: ShellSection;
  actions?: ReactNode;
  rightPanel?: ReactNode;
  children: ReactNode;
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
  const { currentProjectId, selectProject } = useProjectSelection(projects);

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
        <Sidebar
          active={active}
          online={connectionState === "online"}
          projects={projects}
          currentProjectId={currentProjectId}
          onProjectSelect={selectProject}
        />
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
