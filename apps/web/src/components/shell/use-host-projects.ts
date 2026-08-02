import type { ExecutionHostProjectsEntry } from "@otomat/domain";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { desktopBridge } from "@web/lib/desktop-bridge";

/**
 * Every configured execution host with its project catalog, fetched by the
 * desktop main process. Disabled in the browser, where only one daemon exists.
 */
export function useHostProjects(): UseQueryResult<ExecutionHostProjectsEntry[]> {
  const bridge = desktopBridge();
  return useQuery({
    queryKey: ["execution-host", "projects"],
    queryFn: () => {
      if (bridge === null) throw new Error("host projects need the desktop bridge");
      return bridge.executionHost.listProjects();
    },
    enabled: bridge !== null,
    refetchInterval: 15_000,
  });
}
