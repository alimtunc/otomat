import {
  AppSidebar,
  NavSection,
  ProjectSwitcher,
  SidebarDaemonStatus,
  SidebarNavItem,
  type ProjectSummary,
} from "@otomat/ui";
import { Link } from "@tanstack/react-router";

export type ShellSection = "issues" | "settings";

export function Sidebar({
  active,
  online,
  daemonVersion,
  projects,
  currentProjectId,
  onProjectSelect,
}: {
  active: ShellSection;
  online: boolean;
  daemonVersion?: string;
  projects: ProjectSummary[];
  currentProjectId?: string;
  onProjectSelect: (id: string) => void;
}) {
  const projectSwitcher = (
    <ProjectSwitcher projects={projects} currentId={currentProjectId} onSelect={onProjectSelect} />
  );
  const footer = (
    <SidebarDaemonStatus online={online} version={daemonVersion && `v${daemonVersion}`} />
  );
  return (
    <AppSidebar projectSwitcher={projectSwitcher} footer={footer}>
      <NavSection label="Workspace">
        <SidebarNavItem
          icon="list-todo"
          label="Issues"
          active={active === "issues"}
          render={({ className, children, ...rest }) => (
            <Link to="/issues" className={className} {...rest}>
              {children}
            </Link>
          )}
        />
      </NavSection>
      <NavSection label="Configure">
        <SidebarNavItem
          icon="settings"
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
