import type { ProjectSummary } from "@otomat/ui";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useDaemonStatus, useHealth, useProjects } from "@web/api/daemon/queries";
import { useProjectRuns } from "@web/api/runs/queries";
import { useProjectSelection } from "@web/components/shell/use-project-selection";
import { isProjectScopedDetail } from "@web/lib/project-navigation";
import { isReviewable, isRunning } from "@web/lib/run-filters";

export function useShellData() {
  const { connectionState, lastSyncAt, retry } = useDaemonStatus();
  const health = useHealth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const projectsQuery = useProjects();

  const projects: ProjectSummary[] = (projectsQuery.data ?? []).map((project) => ({
    id: project.id,
    name: project.name,
    repo: project.root_path.split("/").filter(Boolean).at(-1),
  }));

  const { currentProjectId, selectProject: select } = useProjectSelection(projects);
  const currentProject = projects.find((project) => project.id === currentProjectId);
  const runs = useProjectRuns(currentProjectId);

  // A detail view shows one entity of the old project; switching leaves it for the new project's issues.
  function selectProject(projectId: string): void {
    select(projectId);
    if (isProjectScopedDetail(pathname)) navigate({ to: "/issues" });
  }
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
