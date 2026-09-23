import type { RunEventWindow } from "@otomat/domain";
import { infiniteQueryOptions, skipToken, type QueryKey } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import type { HostQueryKeys } from "@web/api/query-keys";

type ReadWindow = (params: { before?: number }) => Promise<RunEventWindow>;

export function eventWindowOptions(queryKey: QueryKey, readWindow: ReadWindow | null) {
  return infiniteQueryOptions({
    queryKey,
    queryFn:
      readWindow === null
        ? skipToken
        : ({ pageParam }) => readWindow(pageParam === null ? {} : { before: pageParam }),
    // SAFETY: seeds TanStack's page-param type; the daemon pages by the seq cursor.
    initialPageParam: null as number | null,
    getPreviousPageParam: (firstPage) => firstPage.older_cursor,
    getNextPageParam: () => null,
    staleTime: Infinity,
  });
}

export function stepEventWindowOptions(keys: HostQueryKeys, runId: string, stepId: string) {
  return eventWindowOptions(keys.stepEventWindow(runId, stepId), (params) =>
    daemon.getStepEventWindow(runId, stepId, params),
  );
}

export function runEventWindowOptions(keys: HostQueryKeys, runId: string | null) {
  return eventWindowOptions(
    keys.runEventWindow(runId ?? ""),
    runId === null ? null : (params) => daemon.getRunEventWindow(runId, params),
  );
}
