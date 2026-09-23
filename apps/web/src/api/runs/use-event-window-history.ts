import type { EventEnvelope } from "@otomat/domain";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { eventWindowOptions } from "@web/api/runs/event-window";
import { useCallback, useMemo } from "react";

export interface RunEventHistory {
  events: EventEnvelope[];
  /** `error` only when no page ever landed; a failed older page is `olderFailed`. */
  status: "pending" | "ready" | "error";
  tailSeq: number | null;
  hasOlder: boolean;
  loadingOlder: boolean;
  olderFailed: boolean;
  loadOlder: () => void;
  retry: () => void;
}

export function useEventWindowHistory(
  options: ReturnType<typeof eventWindowOptions>,
): RunEventHistory {
  const query = useInfiniteQuery(options);

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
