import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

/** Connection state lives in daemon memory, so it is re-read on mount rather than cached for long. */
export function useLinearConnection() {
  return useQuery({
    queryKey: queryKeys.linearConnection,
    queryFn: () => daemon.getLinearConnection(),
  });
}

/** Teams and projects require a live connection; disabled while disconnected so the panel shows no spurious error. */
export function useLinearWorkspace(connected: boolean) {
  return useQuery({
    queryKey: queryKeys.linearWorkspace,
    queryFn: () => daemon.getLinearWorkspace(),
    enabled: connected,
    staleTime: 30_000,
  });
}

/** Mapped sources come from SQLite, so they stay readable with no network. */
export function useIssueSources() {
  return useQuery({
    queryKey: queryKeys.issueSources,
    queryFn: () => daemon.listIssueSources(),
  });
}
