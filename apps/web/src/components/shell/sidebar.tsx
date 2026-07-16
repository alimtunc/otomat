import {
  AppSidebar,
  NavSection,
  ProjectSwitcher,
  SidebarDaemonStatus,
  SidebarNavItem,
  type IconName,
  type ProjectSummary,
} from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { useRuns } from "@web/api/runs/queries";
import type { ReactNode } from "react";

export type ShellSection =
  | "issues"
  | "runs"
  | "reviews"
  | "agents"
  | "usage"
  | "runtimes"
  | "skills"
  | "settings"
  | "inbox";

interface SidebarProps {
  active: ShellSection;
  online: boolean;
  daemonVersion?: string;
  projects: ProjectSummary[];
  currentProjectId?: string;
  onProjectSelect: (id: string) => void;
  onSearch?: () => void;
  onNewIssue?: () => void;
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

const WORKSPACE_ITEMS: { section: ShellSection; icon: IconName; label: string; to: string }[] = [
  { section: "issues", icon: "list-todo", label: "Issues", to: "/issues" },
  { section: "runs", icon: "activity", label: "Runs", to: "/runs" },
  { section: "reviews", icon: "git-pull-request", label: "Reviews", to: "/reviews" },
  { section: "agents", icon: "bot", label: "Agents", to: "/agents" },
  { section: "usage", icon: "bar-chart", label: "Usage", to: "/usage" },
];

export function Sidebar({
  active,
  online,
  daemonVersion,
  projects,
  currentProjectId,
  onProjectSelect,
  onSearch,
  onNewIssue,
}: SidebarProps) {
  const runs = useRuns();
  const liveRun = (runs.data ?? []).some((run) => run.status === "running");
  const reviewCount = (runs.data ?? []).filter((run) => run.status === "review_ready").length;

  const projectSwitcher = (
    <ProjectSwitcher projects={projects} currentId={currentProjectId} onSelect={onProjectSelect} />
  );
  const footer = (
    <SidebarDaemonStatus online={online} version={daemonVersion && `v${daemonVersion}`} />
  );
  return (
    <AppSidebar projectSwitcher={projectSwitcher} footer={footer}>
      <nav aria-label="Quick actions" className="mt-1 flex flex-col gap-px px-2">
        {onSearch ? (
          <SidebarNavItem icon="search" label="Search" kbd="⌘K" onClick={onSearch} as="button" />
        ) : null}
        {onNewIssue ? (
          <SidebarNavItem icon="plus" label="New issue" kbd="C" onClick={onNewIssue} as="button" />
        ) : null}
        <SidebarNavItem
          icon="inbox"
          label="Inbox"
          active={active === "inbox"}
          render={navRender("/inbox")}
        />
      </nav>
      <NavSection label="Workspace">
        {WORKSPACE_ITEMS.map((item) => (
          <SidebarNavItem
            key={item.section}
            icon={item.icon}
            label={item.label}
            active={active === item.section}
            live={item.section === "runs" && liveRun}
            badgeCount={item.section === "reviews" && reviewCount > 0 ? reviewCount : undefined}
            render={navRender(item.to)}
          />
        ))}
      </NavSection>
      <NavSection label="Configure">
        <SidebarNavItem
          icon="cpu"
          label="Runtimes"
          active={active === "runtimes"}
          render={navRender("/settings/runtimes")}
        />
        <SidebarNavItem
          icon="book"
          label="Skills"
          active={active === "skills"}
          render={navRender("/skills")}
        />
        <SidebarNavItem
          icon="settings"
          label="Settings"
          active={active === "settings"}
          render={navRender("/settings/repositories")}
        />
      </NavSection>
      <NavSection label="Reference">
        <SidebarNavItem icon="layers" label="Design system" href="/gallery.html" />
      </NavSection>
    </AppSidebar>
  );
}
