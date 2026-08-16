import type { ExecutionHostSnapshot } from "@otomat/domain";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { queryKeys } from "@web/api/query-keys";
import { desktopBridge, requireDesktopBridge } from "@web/lib/desktop-bridge";

/** The shell's own host snapshot, read through one query key so every reader sees the same answer. */
export function useHostSnapshot(): UseQueryResult<ExecutionHostSnapshot> {
  const bridge = desktopBridge();
  return useQuery({
    queryKey: queryKeys.executionHost,
    queryFn: () => requireDesktopBridge(bridge).executionHost.snapshot(),
    enabled: bridge !== null,
  });
}
