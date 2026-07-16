import {
  AppShell,
  Breadcrumbs,
  CommandPalette,
  ConnectionStatusIndicator,
  Icon,
  Topbar,
  useCommandPalette,
  useTheme,
  type BreadcrumbItem,
  type IconName,
  type ProjectSummary,
} from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { useDaemonStatus, useHealth, useProjects } from "@web/api/daemon/queries";
import { NewIssueDialog } from "@web/components/issues/new-issue-dialog";
import { Sidebar, type ShellSection } from "@web/components/shell/sidebar";
import { usePaletteGroups } from "@web/components/shell/use-palette-groups";
import { useProjectSelection } from "@web/components/shell/use-project-selection";
import { useState, type ReactNode } from "react";

export interface RouteShellProps {
  breadcrumbs: BreadcrumbItem[];
  active: ShellSection;
  /** Icon shown next to the title when the view has a single root crumb. */
  titleIcon?: IconName;
  /** Muted sentence after the title (prototype vhead note). */
  titleNote?: string;
  /** Extra inline content after the breadcrumbs (status chip, sha…). */
  breadcrumbExtra?: ReactNode;
  actions?: ReactNode;
  rightPanel?: ReactNode;
  children: ReactNode;
}

export function RouteShell({
  breadcrumbs,
  active,
  titleIcon,
  titleNote,
  breadcrumbExtra,
  actions,
  rightPanel,
  children,
}: RouteShellProps) {
  const { density } = useTheme();
  const { connectionState, lastSyncAt, retry } = useDaemonStatus();
  const health = useHealth();
  const projectsQuery = useProjects();
  const projects: ProjectSummary[] = (projectsQuery.data ?? []).map((project) => ({
    id: project.id,
    name: project.name,
    repo: project.root_path.split("/").filter(Boolean).at(-1),
  }));
  const { currentProjectId, selectProject } = useProjectSelection(projects);
  const currentProject = projects.find((project) => project.id === currentProjectId);
  const palette = useCommandPalette();
  const [newIssueOpen, setNewIssueOpen] = useState(false);
  const paletteGroups = usePaletteGroups({ onNewIssue: () => setNewIssueOpen(true) });

  const topbar = (
    <Topbar
      breadcrumbs={
        <span className="truncate text-sm text-text-secondary">
          {currentProject?.repo ?? currentProject?.name ?? ""}
        </span>
      }
      onSearch={() => palette.setOpen(true)}
      connectionStatus={
        <ConnectionStatusIndicator
          state={connectionState}
          lastSyncAt={lastSyncAt}
          onRetry={retry}
        />
      }
    />
  );

  const isTitle = breadcrumbs.length === 1;

  return (
    <AppShell
      density={density}
      connectionState={connectionState}
      sidebar={
        <Sidebar
          active={active}
          online={connectionState === "online"}
          daemonVersion={health.data?.version}
          projects={projects}
          currentProjectId={currentProjectId}
          onProjectSelect={selectProject}
          onSearch={() => palette.setOpen(true)}
          onNewIssue={() => setNewIssueOpen(true)}
        />
      }
      rightPanel={rightPanel}
      topbar={topbar}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-12 flex-none items-center gap-2.5 border-b border-border-subtle bg-background px-4.5">
          {isTitle ? (
            <>
              <h1 className="flex items-center gap-2.25 text-md font-semibold text-foreground">
                {titleIcon ? (
                  <Icon
                    name={titleIcon}
                    aria-hidden
                    className="h-4.25 w-4.25 text-text-secondary"
                  />
                ) : null}
                {breadcrumbs[0]?.label}
              </h1>
              {titleNote ? <span className="text-xs text-text-tertiary">{titleNote}</span> : null}
            </>
          ) : (
            <Breadcrumbs
              items={breadcrumbs}
              renderLink={(item, label) => (
                <Link
                  to={item.href as string}
                  className="truncate hover:text-foreground focus-visible:[outline:2px_solid_var(--iris-ring)] focus-visible:rounded-sm"
                >
                  {label}
                </Link>
              )}
            />
          )}
          {breadcrumbExtra}
          <div className="flex-1" />
          {actions}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
      <CommandPalette open={palette.open} onOpenChange={palette.setOpen} groups={paletteGroups} />
      <NewIssueDialog
        open={newIssueOpen}
        onOpenChange={setNewIssueOpen}
        projectName={currentProject?.repo ?? currentProject?.name}
      />
    </AppShell>
  );
}
