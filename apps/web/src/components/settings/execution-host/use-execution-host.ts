import type { ExecutionHostOperationResult, ExecutionHostSnapshot } from "@otomat/domain";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { queryKeys } from "@web/api/query-keys";
import { describeOperationFailure } from "@web/components/shell/remote-session/status-labels";
import { useHostSnapshot } from "@web/components/shell/remote-session/use-host-snapshot";
import { desktopBridge, requireDesktopBridge } from "@web/lib/desktop-bridge";
import { useState } from "react";

export interface UseExecutionHostResult {
  isDesktop: boolean;
  snapshot: UseQueryResult<ExecutionHostSnapshot>;
  aliases: string[];
  pending: "configure" | "remove" | null;
  actionError: string | null;
  configureRemote(sshAlias: string): Promise<boolean>;
  removeRemote(): Promise<boolean>;
}

export function useExecutionHost(): UseExecutionHostResult {
  const bridge = desktopBridge();
  const client = useQueryClient();
  const snapshot = useHostSnapshot();
  const [pending, setPending] = useState<"configure" | "remove" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const aliasesQuery = useQuery({
    queryKey: queryKeys.executionHostAliases,
    queryFn: () => requireDesktopBridge(bridge).executionHost.listSshAliases(),
    enabled: bridge !== null,
  });

  async function runHostAction(
    kind: "configure" | "remove",
    action: () => Promise<ExecutionHostOperationResult>,
  ): Promise<boolean> {
    if (bridge === null) return false;
    setActionError(null);
    setPending(kind);
    try {
      const result = await action();
      if (!result.ok) {
        setActionError(describeOperationFailure(result));
        return false;
      }
      return true;
    } catch (error) {
      setActionError(String(error));
      return false;
    } finally {
      setPending(null);
      void client.invalidateQueries({ queryKey: queryKeys.executionHost });
    }
  }

  return {
    isDesktop: bridge !== null,
    snapshot,
    aliases: aliasesQuery.data ?? [],
    pending,
    actionError,
    configureRemote: (sshAlias: string) =>
      runHostAction("configure", () =>
        requireDesktopBridge(bridge).executionHost.configureRemote(sshAlias),
      ),
    removeRemote: () =>
      runHostAction("remove", () => requireDesktopBridge(bridge).executionHost.removeRemote()),
  };
}
