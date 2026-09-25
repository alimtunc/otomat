import type { DaemonClient } from "@otomat/client";
import type { TerminalInventory, TerminalOpenRequest } from "@otomat/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useQueryKeys } from "@web/api/use-query-keys";
import { activeHost } from "@web/lib/active-host";

export function useOpenTerminal(client: DaemonClient) {
  const cache = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationFn: (request: TerminalOpenRequest) => client.openTerminal(request),
    onSuccess: (created) => {
      cache.setQueryData<TerminalInventory>(keys.terminals(activeHost().daemonUrl), (current) =>
        current === undefined
          ? current
          : {
              ...current,
              sessions: [...current.sessions.filter((item) => item.path !== created.path), created],
            },
      );
      void cache.invalidateQueries({ queryKey: keys.workspaces });
    },
  });
}

export function useCloseTerminal(client: DaemonClient) {
  const cache = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationFn: ({ id, instance }: { id: string; instance: string }) =>
      client.closeTerminal(id, instance),
    onSuccess: () => cache.invalidateQueries({ queryKey: keys.terminals(activeHost().daemonUrl) }),
  });
}
