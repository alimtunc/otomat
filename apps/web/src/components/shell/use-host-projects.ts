import type { ExecutionHostProjectsEntry } from "@otomat/domain";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { shellKeys } from "@web/api/query-keys";
import { desktopBridge } from "@web/lib/desktop-bridge";

export function useHostProjects(): UseQueryResult<ExecutionHostProjectsEntry[]> {
  const bridge = desktopBridge();
  return useQuery({
    queryKey: shellKeys.hostProjects,
    queryFn: () => {
      if (bridge === null) throw new Error("host projects need the desktop bridge");
      return bridge.executionHost.listProjects();
    },
    enabled: bridge !== null,
    refetchInterval: 15_000,
  });
}
