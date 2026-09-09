import type { ExecutionHostDescriptor, ProjectContract, ProjectHealthReport } from "@otomat/domain";
import type { UseQueryResult } from "@tanstack/react-query";
import { useHostProjectHealth, type ProjectHealthTarget } from "@web/api/project-health/queries";
import { useHostProjects } from "@web/components/shell/use-host-projects";
import { useActiveHostDescriptor } from "@web/lib/active-host";

export type ProjectHealthAbsence = "unreachable" | "not_registered";

export interface ProjectHealthEntry {
  host: ExecutionHostDescriptor;
  absence: ProjectHealthAbsence | null;
  query: UseQueryResult<ProjectHealthReport>;
}

export interface ProjectHealthResult {
  entries: ProjectHealthEntry[];
  /** True when the hosts could not be enumerated, so the entries below cover the active host alone. */
  hostsUnknown: boolean;
  refresh(): void;
  refreshing: boolean;
}

interface HostTarget extends ProjectHealthTarget {
  descriptor: ExecutionHostDescriptor;
  absence: ProjectHealthAbsence | null;
}

/** Each host answers under its own project id, matched on the root path: asking one about another's project is the fallback this diagnostic exists to rule out. */
export function useProjectHealth(project: ProjectContract): ProjectHealthResult {
  const hostProjects = useHostProjects();
  const activeHost = useActiveHostDescriptor();

  const targets: HostTarget[] =
    hostProjects.data === undefined
      ? [{ descriptor: activeHost, host: activeHost.id, projectId: project.id, absence: null }]
      : hostProjects.data.map((entry) => {
          if (entry.projects === null) {
            return {
              descriptor: entry.host,
              host: entry.host.id,
              projectId: null,
              absence: "unreachable",
            };
          }
          const owned = entry.projects.find(
            (candidate) => candidate.root_path === project.root_path,
          );
          return {
            descriptor: entry.host,
            host: entry.host.id,
            projectId: owned?.id ?? null,
            absence: owned === undefined ? "not_registered" : null,
          };
        });

  const queries = useHostProjectHealth(targets);

  return {
    entries: targets.flatMap((target, index) => {
      const query = queries[index];
      return query === undefined
        ? []
        : [{ host: target.descriptor, absence: target.absence, query }];
    }),
    hostsUnknown: hostProjects.isError && hostProjects.data === undefined,
    refresh: () => {
      // `refetch` ignores `enabled`, and outside the desktop shell this query has no bridge to call.
      if (hostProjects.isEnabled) void hostProjects.refetch();
      for (const [index, target] of targets.entries()) {
        // Refetching a skipped query invokes its absent queryFn and fails it; an absent host has nothing to re-run.
        if (target.projectId !== null) void queries[index]?.refetch();
      }
    },
    // Deliberately not `hostProjects`: its 15s interval refetch would pulse the button on its own.
    refreshing: queries.some((query) => query.isFetching),
  };
}
