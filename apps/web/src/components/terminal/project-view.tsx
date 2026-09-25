import { EmptyState } from "@otomat/ui";
import { useSelectedProject } from "@web/components/shell/project-selection/use-selected";
import { RouteShell } from "@web/components/shell/route-shell";

import { TerminalWorkspace } from "./workspace";

export function ProjectTerminalView() {
  const { projectId, projects } = useSelectedProject();
  const project = projects.data?.find((item) => item.id === projectId);
  return (
    <RouteShell titleIcon="terminal" breadcrumbs={[{ label: "Terminal", current: true }]}>
      {project === undefined ? (
        <EmptyState
          icon="terminal"
          title="No project selected"
          description="Select a project to open its terminal."
        />
      ) : (
        <div className="h-full min-h-0 p-4">
          <TerminalWorkspace projectId={project.id} rootPath={project.root_path} />
        </div>
      )}
    </RouteShell>
  );
}
