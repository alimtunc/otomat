import type { ExecutionHostId, ProjectHealthReport } from "@otomat/domain";
import { queryOptions, skipToken, useQueries, type UseQueryResult } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { onExecutionHost } from "@web/api/host-call";
import { hostKeys } from "@web/api/query-keys";

/** The checks spawn git and gh on the host, so revisiting the screen reuses a recent report; the explicit action always refetches. */
const HEALTH_STALE_TIME = 30_000;

export interface ProjectHealthTarget {
  host: ExecutionHostId;
  /** The project's id on that host; null when it holds no project for this path. */
  projectId: string | null;
}

/** One query per host: a host that fails or times out never clears another host's report. */
export function useHostProjectHealth(
  targets: readonly ProjectHealthTarget[],
): UseQueryResult<ProjectHealthReport>[] {
  return useQueries({
    queries: targets.map(({ host, projectId }) =>
      queryOptions({
        queryKey: hostKeys(host).projectHealthFor(projectId),
        queryFn:
          projectId === null
            ? skipToken
            : () =>
                onExecutionHost(
                  host,
                  () => daemon.projectHealth(projectId),
                  (executionHost) => executionHost.readProjectHealth(host, projectId),
                ),
        staleTime: HEALTH_STALE_TIME,
      }),
    ),
  });
}
