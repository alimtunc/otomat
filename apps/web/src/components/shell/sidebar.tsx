import {
  AppSidebar,
  NavSection,
  ProjectSwitcher,
  SidebarDaemonStatus,
  SidebarNavItem,
  type ProjectSummary,
} from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { CircleDot, ListTodo, Settings } from "lucide-react";

export type ShellSection = "issues" | "runs" | "settings";

export function Sidebar({
  active,
  online,
  projects,
}: {
  active: ShellSection;
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
