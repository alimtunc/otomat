import type { ProjectSummary } from "@otomat/ui";
import { useSelector } from "@tanstack/react-store";
import { resolveSelectedProjectId } from "@web/components/shell/project-selection";
import { projectSelectionStore } from "@web/components/shell/project-selection-store";

export interface ProjectSelection {
  currentProjectId: string | undefined;
  selectProject: (projectId: string) => void;
}

export function useProjectSelection(projects: ProjectSummary[]): ProjectSelection {
  const preferredProjectId = useSelector(projectSelectionStore);
  return {
    currentProjectId: resolveSelectedProjectId(projects, preferredProjectId),
    selectProject: projectSelectionStore.actions.select,
  };
}
