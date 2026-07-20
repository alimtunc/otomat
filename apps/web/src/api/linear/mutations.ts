import { DaemonRequestError } from "@otomat/client";
import {
  linearErrorSchema,
  type CreateIssueSourceRequest,
  type SyncLinearRequest,
} from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";
import { desktopBridge } from "@web/lib/desktop-bridge";

/**
 * Submits the key once. Inside Electron it goes through the main process, which
 * validates it against the daemon and only then encrypts it with safeStorage; in
 * a plain browser it goes straight to the daemon and lives only in daemon memory
 * until the next restart.
 */
export function useConnectLinear() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (apiKey: string) => {
      const bridge = desktopBridge();
      if (bridge === null) {
        const connection = await daemon.connectLinear({ api_key: apiKey });
        if (connection.status !== "connected") {
          throw new Error(connection.error_message ?? "Linear rejected the API key.");
        }
        return;
      }
      const result = await bridge.linear.saveKey(apiKey);
      if (!result.ok) throw new Error(result.message ?? "Saving the Linear key failed.");
    },
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.linear }),
  });
}

export function useDisconnectLinear() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const bridge = desktopBridge();
      if (bridge === null) {
        await daemon.disconnectLinear();
        return;
      }
      const result = await bridge.linear.forgetKey();
      if (!result.ok) throw new Error(result.message ?? "Forgetting the Linear key failed.");
    },
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.linear }),
  });
}

export function useCreateIssueSource() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateIssueSourceRequest) => daemon.createIssueSource(request),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.issueSources }),
  });
}

export function useSyncLinear() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: SyncLinearRequest = {}) => daemon.syncLinear(request),
    onSuccess: (response) => {
      const imported = response.results.reduce((total, result) => total + result.imported, 0);
      const updated = response.results.reduce((total, result) => total + result.updated, 0);
      client.invalidateQueries({ queryKey: queryKeys.issues });
      client.invalidateQueries({ queryKey: queryKeys.issueSources });
      toast.success(`Synced Linear — ${imported} imported, ${updated} updated.`);
    },
    onError: (error) => toast.error(linearErrorMessage(error)),
  });
}

/** Preserves the daemon's typed refusal and falls back to a connectivity message otherwise. */
export function linearErrorMessage(error: unknown): string {
  if (error instanceof DaemonRequestError) {
    const refusal = linearErrorSchema.safeParse(error.body);
    if (refusal.success) return refusal.data.message;
    return "The daemon rejected the Linear request.";
  }
  return error instanceof Error ? error.message : "Could not reach the daemon.";
}
