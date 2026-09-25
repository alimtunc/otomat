import { EmptyState } from "@otomat/ui";
import { useSelectedProject } from "@web/components/shell/project-selection/use-selected";
import { RouteShell } from "@web/components/shell/route-shell";

import { TerminalWorkspace } from "./workspace";

export function ProjectTerminalView() {
  const { projectId } = useSelectedProject();
  return (
    <RouteShell titleIcon="terminal" breadcrumbs={[{ label: "Terminal", current: true }]}>
      {projectId === undefined ? (
        <EmptyState
          icon="terminal"
          title="No project selected"
          description="Select a project to open its terminal."
        />
      ) : (
        <div className="h-full min-h-0 p-4">
          <TerminalWorkspace projectId={projectId} />
        </div>
      )}
    </RouteShell>
  );
}
