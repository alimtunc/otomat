import type { ExecutionHostOperationResult, RemoteInstanceEntry } from "@otomat/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { describeOperationFailure } from "@web/components/shell/remote-session/status-labels";
import { desktopBridge } from "@web/lib/desktop-bridge";
import { useState } from "react";

export interface UseRemoteInstancesResult {
  available: boolean;
  instances: RemoteInstanceEntry[] | undefined;
  listError: string | null;
  pending: string | null;
  actionError: string | null;
  stop(build: string): void;
  remove(build: string): void;
}

export function useRemoteInstances(sshAlias: string | null): UseRemoteInstancesResult {
  const bridge = desktopBridge();
  const client = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const available = bridge !== null && sshAlias !== null;

  const query = useQuery({
    queryKey: ["remote-instances", sshAlias],
    enabled: available,
    queryFn: async () => {
      const result = await requireBridge().listInstances();
      if (!result.ok) throw new Error(result.message);
      return result.instances;
    },
  });

  const runAction = (label: string, action: () => Promise<ExecutionHostOperationResult>): void => {
    if (bridge === null || pending !== null) return;
    setPending(label);
    setActionError(null);
    void action().then(
      (result) => {
        setPending(null);
        if (!result.ok) {
          setActionError(describeOperationFailure(result));
          return;
        }
        void client.invalidateQueries({ queryKey: ["remote-instances", sshAlias] });
      },
      (cause: unknown) => {
        setPending(null);
        setActionError(cause instanceof Error ? cause.message : "The instance action failed.");
      },
    );
  };

  return {
    available,
    instances: query.data,
    listError: query.error === null ? null : query.error.message,
    pending,
    actionError,
    stop: (build) => runAction(`stop:${build}`, () => requireBridge().stopInstance(build)),
    remove: (build) => runAction(`delete:${build}`, () => requireBridge().deleteInstance(build)),
  };

  function requireBridge(): NonNullable<typeof bridge>["executionHost"] {
    if (bridge === null) throw new Error("Desktop bridge unavailable.");
    return bridge.executionHost;
  }
}
