import { toast, type ProjectSummary } from "@otomat/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useProjects } from "@web/api/daemon/queries";
import { shellKeys } from "@web/api/query-keys";
import {
  parseProjectSwitcherKey,
  projectSwitcherKey,
} from "@web/components/shell/project-selection/host-key";
import { selectableProjects } from "@web/components/shell/project-selection/selection";
import { projectSelectionStore } from "@web/components/shell/project-selection/store";
import { useProjectSelection } from "@web/components/shell/project-selection/use-selection";
import { projectTabDestination } from "@web/components/shell/project-tabs/state";
import { projectTabsStore } from "@web/components/shell/project-tabs/store";
import { describeOperationFailure } from "@web/components/shell/remote-session/status-labels";
import { useHostProjects } from "@web/components/shell/use-host-projects";
import { activeHostStore, useActiveHostId, useRemoteHostAlias } from "@web/lib/active-host";
import { desktopBridge } from "@web/lib/desktop-bridge";

function lastPathSegment(rootPath: string): string | undefined {
  return rootPath.split("/").filter(Boolean).at(-1);
}

export function useProjectSwitcher() {
  const bridge = desktopBridge();
  const client = useQueryClient();
  const activeHostId = useActiveHostId();
  const hostAlias = useRemoteHostAlias();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const projectsQuery = useProjects();
  const hostProjects = useHostProjects();

  const projects: ProjectSummary[] = selectableProjects(projectsQuery.data ?? []).map(
    (project) => ({
      id: project.id,
      name: project.name,
      repo: lastPathSegment(project.root_path),
    }),
  );

  const currentProjectId = useProjectSelection(projects);
  const currentProject = projects.find((project) => project.id === currentProjectId);

  const hostEntries = hostProjects.data ?? [];
  const multiHost = hostEntries.length > 1;
  const activeHostLabel =
    hostEntries.find((entry) => entry.host.id === activeHostId)?.host.label ?? hostAlias ?? "Local";
  const switcherProjects: ProjectSummary[] = [
    ...projects.map((project) => ({
      ...project,
      id: projectSwitcherKey(activeHostId, project.id),
      tag: multiHost ? activeHostLabel : undefined,
    })),
    ...hostEntries
      .filter((entry) => entry.host.id !== activeHostId)
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
          active: entry.host.id === activeHostId,
        }))
      : [{ id: "local" as const, label: "Local", active: true }];

  // The selection and the navigation land only once the target host answers, so no view shows another host's data.
  const selectProject = (switcherId: string): void => {
    const target = parseProjectSwitcherKey(switcherId, activeHostId);
    const destination = projectTabDestination(projectTabsStore.state, switcherId, pathname);
    const arrive = (): void => {
      projectSelectionStore.actions.select(target.hostId, target.projectId);
      if (destination !== null) void navigate({ href: destination });
    };
    if (target.hostId === activeHostId || bridge === null) {
      arrive();
      return;
    }
    void bridge.executionHost
      .select(target.hostId)
      .then((result) => {
        if (!result.ok) {
          toast.error(describeOperationFailure(result));
          return;
        }
        activeHostStore.actions.activate({ id: target.hostId, daemonUrl: result.url });
        arrive();
        void client.invalidateQueries({ queryKey: shellKeys.executionHost });
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Switching hosts failed.");
      });
  };

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
