import type { DaemonClient } from "@otomat/client";
import type { TerminalTool } from "@otomat/domain";
import { skipToken, useQuery } from "@tanstack/react-query";
import { useQueryKeys } from "@web/api/use-query-keys";
import { activeHost } from "@web/lib/active-host";

export function useTerminalInventory(client: DaemonClient) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.terminals(activeHost().daemonUrl),
    queryFn: () => client.listTerminals(),
    retry: false,
    refetchInterval: 2000,
  });
}

export function useTerminalPreview(
  client: DaemonClient,
  issueId: string | null,
  tool: TerminalTool,
  enabled: boolean,
) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.terminalContext(activeHost().daemonUrl, issueId, tool),
    queryFn: issueId === null ? skipToken : () => client.terminalPreview(issueId, tool),
    enabled,
    retry: false,
  });
}
