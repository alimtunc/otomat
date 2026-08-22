import type { EventEnvelope, RunEventWindow } from "@otomat/domain";
import { useInfiniteQuery, type QueryKey } from "@tanstack/react-query";
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

export function useEventWindowHistory(
  queryKey: QueryKey,
  readWindow: (params: { before?: number }) => Promise<RunEventWindow>,
): RunEventHistory {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => readWindow(pageParam === null ? {} : { before: pageParam }),
    // SAFETY: seeds TanStack's page-param type; the daemon pages by the seq cursor.
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
