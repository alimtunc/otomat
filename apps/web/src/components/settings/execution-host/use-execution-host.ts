import type {
  ExecutionHostOperationResult,
  ExecutionHostSnapshot,
  RemoteHostStatus,
} from "@otomat/domain";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { desktopBridge } from "@web/lib/desktop-bridge";
import { useEffect, useState } from "react";

import { describeRemoteStatus } from "./status-labels";

function failureMessage(result: Extract<ExecutionHostOperationResult, { ok: false }>): string {
  return "status" in result ? describeRemoteStatus(result.status) : result.message;
}

export interface UseExecutionHostResult {
  /** False in a plain browser, where hosts are managed by the desktop app only. */
  isDesktop: boolean;
  snapshot: UseQueryResult<ExecutionHostSnapshot>;
  aliases: string[];
  /** Live remote status pushed by the main process, falling back to the snapshot's. */
  remoteStatus: RemoteHostStatus | null;
  pending: "configure" | "remove" | null;
  actionError: string | null;
  configureRemote(sshAlias: string): Promise<boolean>;
  removeRemote(): Promise<boolean>;
}

export function useExecutionHost(): UseExecutionHostResult {
  const bridge = desktopBridge();
  const client = useQueryClient();
  const [liveStatus, setLiveStatus] = useState<RemoteHostStatus | null>(null);
  const [pending, setPending] = useState<"configure" | "remove" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const snapshot = useQuery({
    queryKey: ["execution-host"],
    queryFn: () => {
      if (bridge === null) throw new Error("The desktop bridge is not available.");
      return bridge.executionHost.snapshot();
    },
    enabled: bridge !== null,
  });

  const aliasesQuery = useQuery({
    queryKey: ["execution-host-aliases"],
    queryFn: () => {
      if (bridge === null) throw new Error("The desktop bridge is not available.");
      return bridge.executionHost.listSshAliases();
    },
    enabled: bridge !== null,
  });

  // otomat-allow-effect: subscribe to the main process's remote-status push channel and detach on unmount.
  useEffect(() => {
    if (bridge === null) return;
    return bridge.executionHost.onRemoteStatus((status) => {
      setLiveStatus(status);
      void client.invalidateQueries({ queryKey: ["execution-host"] });
    });
  }, [bridge, client]);

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
        setActionError(failureMessage(result));
        return false;
      }
      return true;
    } catch (error) {
      setActionError(String(error));
      return false;
    } finally {
      setPending(null);
      void client.invalidateQueries({ queryKey: ["execution-host"] });
    }
  }

  return {
    isDesktop: bridge !== null,
    snapshot,
    aliases: aliasesQuery.data ?? [],
    remoteStatus: liveStatus ?? snapshot.data?.remote_status ?? null,
    pending,
    actionError,
    configureRemote: (sshAlias: string) =>
      runHostAction("configure", () => {
        if (bridge === null) throw new Error("The desktop bridge is not available.");
        return bridge.executionHost.configureRemote(sshAlias);
      }),
    removeRemote: () =>
      runHostAction("remove", () => {
        if (bridge === null) throw new Error("The desktop bridge is not available.");
        return bridge.executionHost.removeRemote();
      }),
  };
}
