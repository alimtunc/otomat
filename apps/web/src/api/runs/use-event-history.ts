import type { EventEnvelope } from "@otomat/domain";
import { useInfiniteQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";
import { useCallback, useMemo } from "react";

export interface RunEventHistory {
  /** The loaded pages in `seq` order; the live tail is not part of them. */
  events: EventEnvelope[];
  /** `pending` until the newest page lands; `error` only when no page ever did. */
  status: "pending" | "ready" | "error";
  /** `seq` the live stream resumes from, null while no page carries an event. */
  tailSeq: number | null;
  hasOlder: boolean;
  loadingOlder: boolean;
  /** The last older-page read failed; the loaded pages are intact and `loadOlder` retries it. */
  olderFailed: boolean;
  loadOlder: () => void;
  retry: () => void;
}

export function useEventHistory(runId: string): RunEventHistory {
  const query = useInfiniteQuery({
    queryKey: queryKeys.runEventWindow(runId),
    queryFn: ({ pageParam }) =>
      daemon.getRunEventWindow(runId, pageParam === null ? {} : { before: pageParam }),
    initialPageParam: null as number | null,
    getPreviousPageParam: (firstPage) => firstPage.older_cursor,
    getNextPageParam: () => null,
    staleTime: Infinity,
  });

  const pages = query.data?.pages;
  const events = useMemo(() => (pages ?? []).flatMap((page) => page.events), [pages]);
  const { fetchPreviousPage, refetch } = query;
  const loadOlder = useCallback(() => void fetchPreviousPage(), [fetchPreviousPage]);
  const retry = useCallback(() => void refetch(), [refetch]);

  let status: RunEventHistory["status"] = "ready";
  if (pages === undefined) status = query.isError ? "error" : "pending";

  return {
    events,
    status,
    tailSeq: pages?.at(-1)?.events.at(-1)?.seq ?? null,
    hasOlder: query.hasPreviousPage,
    loadingOlder: query.isFetchingPreviousPage,
    olderFailed: query.isFetchPreviousPageError,
    loadOlder,
    retry,
  };
}
