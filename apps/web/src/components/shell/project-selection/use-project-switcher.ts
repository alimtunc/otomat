import { toast, type ProjectSummary } from "@otomat/ui";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useProjects } from "@web/api/daemon/queries";
import {
  parseProjectSwitcherKey,
  projectSwitcherKey,
} from "@web/components/shell/project-selection/host-key";
import {
  selectableProjects,
  writeSelectedProjectId,
} from "@web/components/shell/project-selection/selection";
import { useProjectSelection } from "@web/components/shell/project-selection/use-selection";
import { projectTabDestination } from "@web/components/shell/project-tabs/state";
import { projectTabsStore } from "@web/components/shell/project-tabs/store";
import { describeOperationFailure } from "@web/components/shell/remote-session/status-labels";
import { useHostProjects } from "@web/components/shell/use-host-projects";
import { activeExecutionHostId, desktopBridge, remoteHostAlias } from "@web/lib/desktop-bridge";

function lastPathSegment(rootPath: string): string | undefined {
  return rootPath.split("/").filter(Boolean).at(-1);
}

export function useProjectSwitcher() {
  const bridge = desktopBridge();
  const activeHostId = activeExecutionHostId();
  const hostAlias = remoteHostAlias();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const href = useRouterState({ select: (state) => state.location.href });
  const projectsQuery = useProjects();
  const hostProjects = useHostProjects();

  const projects: ProjectSummary[] = selectableProjects(projectsQuery.data ?? []).map(
    (project) => ({
      id: project.id,
      name: project.name,
      repo: lastPathSegment(project.root_path),
    }),
  );

  const { currentProjectId, selectProject: select } = useProjectSelection(projects);
  const currentProject = projects.find((project) => project.id === currentProjectId);

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
        selectableProjects(entry.projects ?? []).map((project) => ({
          id: projectSwitcherKey(entry.host.id, project.id),
          name: project.name,
          repo: lastPathSegment(project.root_path),
          tag: entry.host.label,
        })),
      ),
  ];
  const hostOptions =
    hostEntries.length > 0
      ? hostEntries.map((entry) => ({
          id: entry.host.id,
          label: entry.host.label,
          active: entry.active,
        }))
      : [{ id: "local" as const, label: "Local", active: true }];

  function selectProject(switcherId: string): void {
    const target = parseProjectSwitcherKey(switcherId, activeHostId);
    const destination = projectTabDestination(projectTabsStore.state, switcherId, pathname);
    if (target.hostId === activeHostId || bridge === null) {
      select(target.projectId);
      if (destination !== null) void navigate({ href: destination });
      return;
    }
    const rollBack = (): void => {
      if (destination !== null) void navigate({ href });
    };
    if (destination !== null) void navigate({ href: destination });
    writeSelectedProjectId(target.hostId, target.projectId);
    void bridge.executionHost
      .select(target.hostId)
      .then((result) => {
        if (result.ok) return;
        const concurrent =
          "status" in result &&
          result.status.phase === "error" &&
          result.status.code === "switch_in_progress";
        if (!concurrent) rollBack();
        toast.error(describeOperationFailure(result));
      })
      .catch((error: unknown) => {
        rollBack();
        toast.error(error instanceof Error ? error.message : "Switching hosts failed.");
      });
  }

  return {
    hostAlias,
    activeHostLabel,
    hostOptions,
    projects: switcherProjects,
    currentProjectId,
    currentSwitcherId:
      currentProjectId === undefined
        ? undefined
        : projectSwitcherKey(activeHostId, currentProjectId),
    selectProject,
    projectLabel: currentProject?.repo ?? currentProject?.name,
  };
}
