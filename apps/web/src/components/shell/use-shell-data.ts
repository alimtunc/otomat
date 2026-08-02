import { toast, type ProjectSummary } from "@otomat/ui";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useDaemonStatus, useHealth, useProjects } from "@web/api/daemon/queries";
import { useProjectRuns } from "@web/api/runs/queries";
import { describeRemoteStatus } from "@web/components/settings/execution-host/status-labels";
import {
  parseProjectSwitcherKey,
  projectSwitcherKey,
} from "@web/components/shell/project-selection/host-key";
import { writeSelectedProjectId } from "@web/components/shell/project-selection/selection";
import { useProjectSelection } from "@web/components/shell/project-selection/use-selection";
import { useHostProjects } from "@web/components/shell/use-host-projects";
import { desktopBridge, remoteHostAlias } from "@web/lib/desktop-bridge";
import { isProjectScopedDetail } from "@web/lib/project-navigation";
import { isReviewable, isRunning } from "@web/lib/run/filters";

function lastPathSegment(rootPath: string): string | undefined {
  return rootPath.split("/").filter(Boolean).at(-1);
}

export function useShellData() {
  const { connectionState, lastSyncAt, retry } = useDaemonStatus();
  const health = useHealth();
  const bridge = desktopBridge();
  const activeHostId = bridge?.executionHostId ?? "local";
  const hostAlias = remoteHostAlias();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const projectsQuery = useProjects();
  const hostProjects = useHostProjects();

  const projects: ProjectSummary[] = (projectsQuery.data ?? []).map((project) => ({
    id: project.id,
    name: project.name,
    repo: lastPathSegment(project.root_path),
  }));

  const { currentProjectId, selectProject: select } = useProjectSelection(projects);
  const currentProject = projects.find((project) => project.id === currentProjectId);
  const runs = useProjectRuns(currentProjectId);

  const hostEntries = hostProjects.data ?? [];
  const multiHost = hostEntries.length > 1;
  const activeHostLabel =
    hostEntries.find((entry) => entry.active)?.host.label ?? hostAlias ?? "Local";
  const switcherProjects: ProjectSummary[] = [
    ...projects.map((project) => ({
      ...project,
      id: projectSwitcherKey(activeHostId, project.id),
      tag: multiHost ? activeHostLabel : undefined,
    })),
    ...hostEntries
      .filter((entry) => !entry.active)
      .flatMap((entry) =>
        (entry.projects ?? []).map((project) => ({
          id: projectSwitcherKey(entry.host.id, project.id),
          name: project.name,
          repo: lastPathSegment(project.root_path),
          tag: entry.host.label,
        })),
      ),
  ];

  // A detail view shows one entity of the old project; switching leaves it for the new project's issues.
  function selectProject(switcherId: string): void {
    const target = parseProjectSwitcherKey(switcherId, activeHostId);
    if (target.hostId === activeHostId || bridge === null) {
      select(target.projectId);
      if (isProjectScopedDetail(pathname)) navigate({ to: "/issues" });
      return;
    }
    // Cross-host: persist the choice so the reloaded renderer restores it, then re-point at that host's daemon.
    const previous = currentProjectId;
    writeSelectedProjectId(target.projectId);
    void bridge.executionHost.select(target.hostId).then((result) => {
      if (result.ok) return;
      if (previous !== undefined) writeSelectedProjectId(previous);
      toast.error("message" in result ? result.message : describeRemoteStatus(result.status));
    });
  }

  return {
    connectionState,
    lastSyncAt,
    retry,
    daemonVersion: health.data?.version,
    hostAlias,
    projects: switcherProjects,
    currentProjectId,
    currentSwitcherId:
      currentProjectId === undefined
        ? undefined
        : projectSwitcherKey(activeHostId, currentProjectId),
    selectProject,
    projectLabel: currentProject?.repo ?? currentProject?.name,
    hasLiveRun: (runs.data ?? []).some(isRunning),
    reviewCount: (runs.data ?? []).filter(isReviewable).length,
  };
}
