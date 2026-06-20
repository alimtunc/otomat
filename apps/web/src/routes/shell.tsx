import {
  AppShell,
  AppSidebar,
  Breadcrumbs,
  ConnectionStatusIndicator,
  NavSection,
  ProjectSwitcher,
  SidebarDaemonStatus,
  SidebarNavItem,
  Topbar,
  useTheme,
  type BreadcrumbItem,
  type ConnectionState,
} from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { CircleDot, ListTodo, Settings } from "lucide-react";
import type { ReactNode } from "react";

export interface RouteShellProps {
  breadcrumbs: BreadcrumbItem[];
  active: "issues" | "runs" | "settings";
  actions?: ReactNode;
  rightPanel?: ReactNode;
  connectionState?: ConnectionState;
  children: ReactNode;
}

const NO_PROJECTS: never[] = [];
const PROJECT_SWITCHER = <ProjectSwitcher projects={NO_PROJECTS} onSelect={() => {}} />;

function Sidebar({ active }: { active: RouteShellProps["active"] }) {
  return (
    <AppSidebar projectSwitcher={PROJECT_SWITCHER} footer={<SidebarDaemonStatus online={false} />}>
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
  connectionState = "online",
  children,
}: RouteShellProps) {
  const { density } = useTheme();

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
      connectionStatus={<ConnectionStatusIndicator state={connectionState} />}
      actions={actions}
    />
  );

  return (
    <AppShell
      density={density}
      connectionState={connectionState}
      sidebar={<Sidebar active={active} />}
      rightPanel={rightPanel}
      topbar={topbar}
    >
      {children}
    </AppShell>
  );
}
