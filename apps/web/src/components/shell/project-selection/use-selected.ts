import { useProjects } from "@web/api/daemon/queries";
import { selectableProjects } from "@web/components/shell/project-selection/selection";
import { useProjectSelection } from "@web/components/shell/project-selection/use-selection";

/** Returns the resolved selection with its query so callers can preserve loading and error states. */
export function useSelectedProject() {
  const projects = useProjects();
  const summaries = selectableProjects(projects.data ?? []).map((project) => ({
    id: project.id,
    name: project.name,
  }));
  return {
    projectId: useProjectSelection(summaries).currentProjectId,
    projects,
  };
}
