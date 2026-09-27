import { FOCUS_RING, Icon } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { WORKSPACE_NAV } from "@web/components/shell/nav-items";
import { ProjectQueryBoundary } from "@web/components/shell/project-selection/query-boundary";
import { useSelectedProject } from "@web/components/shell/project-selection/use-selected";
import { RouteShell } from "@web/components/shell/route-shell";

export function ProjectHome() {
  const { projectId, projects } = useSelectedProject();
  const project = projects.data?.find((entry) => entry.id === projectId);
  return (
    <RouteShell breadcrumbs={[{ label: "Project", current: true }]} titleIcon="folder">
      <ProjectQueryBoundary query={projects} unselectedIcon="folder">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-8 sm:px-10">
          <div>
            <h2 className="break-words text-xl font-semibold">{project?.name}</h2>
            <p className="mt-2 text-sm text-text-secondary">
              All project features. Use + to open another tab.
            </p>
          </div>
          <nav aria-label="Project features" className="grid gap-2 sm:grid-cols-2">
            {[
              ...WORKSPACE_NAV,
              { to: "/settings/project", label: "Project settings", icon: "settings" as const },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-lg border border-border-subtle p-4 text-sm hover:bg-hover ${FOCUS_RING}`}
              >
                <Icon name={item.icon} aria-hidden />
                {item.label}
                <Icon
                  name="chevron-right"
                  className="ml-auto size-4 text-text-tertiary"
                  aria-hidden
                />
              </Link>
            ))}
          </nav>
        </div>
      </ProjectQueryBoundary>
    </RouteShell>
  );
}
