import { useProjects } from "@web/api/daemon/queries";
import { useProjectSelection } from "@web/components/shell/use-project-selection";

/** The resolved selected project id for views that scope their data without rendering the switcher. */
export function useSelectedProjectId(): string | undefined {
  const projects = useProjects();
  const summaries = (projects.data ?? []).map((project) => ({
    id: project.id,
    name: project.name,
  }));
  return useProjectSelection(summaries).currentProjectId;
}
