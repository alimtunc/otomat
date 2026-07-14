import type { ProjectSummary } from "@otomat/ui";
import {
  readSelectedProjectId,
  resolveSelectedProjectId,
  writeSelectedProjectId,
} from "@web/components/shell/project-selection";
import { useState } from "react";

export interface ProjectSelection {
  currentProjectId: string | undefined;
  selectProject: (projectId: string) => void;
}

export function useProjectSelection(projects: ProjectSummary[]): ProjectSelection {
  const [preferredProjectId, setPreferredProjectId] = useState(() => readSelectedProjectId());
  const currentProjectId = resolveSelectedProjectId(projects, preferredProjectId);

  function selectProject(projectId: string): void {
    setPreferredProjectId(projectId);
    writeSelectedProjectId(projectId);
  }

  return { currentProjectId, selectProject };
}
