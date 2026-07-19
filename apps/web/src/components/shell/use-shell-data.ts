import type { ProjectSummary } from "@otomat/ui";
import { useDaemonStatus, useHealth, useProjects } from "@web/api/daemon/queries";
import { useProjectRuns } from "@web/api/runs/queries";
import { useProjectSelection } from "@web/components/shell/use-project-selection";
import { isReviewable, isRunning } from "@web/lib/run-filters";

export function useShellData() {
  const { connectionState, lastSyncAt, retry } = useDaemonStatus();
  const health = useHealth();
  const projectsQuery = useProjects();
  const projects: ProjectSummary[] = (projectsQuery.data ?? []).map((project) => ({
    id: project.id,
    name: project.name,
    repo: project.root_path.split("/").filter(Boolean).at(-1),
  }));
  const { currentProjectId, selectProject } = useProjectSelection(projects);
  const currentProject = projects.find((project) => project.id === currentProjectId);
  const runs = useProjectRuns(currentProjectId);
  return {
    connectionState,
    lastSyncAt,
    retry,
    daemonVersion: health.data?.version,
    projects,
    currentProjectId,
    selectProject,
    projectLabel: currentProject?.repo ?? currentProject?.name,
    hasLiveRun: (runs.data ?? []).some(isRunning),
    reviewCount: (runs.data ?? []).filter(isReviewable).length,
  };
}
