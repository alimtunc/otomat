import { DaemonRequestError } from "@otomat/client";
import {
  linearErrorSchema,
  type CreateIssueSourceRequest,
  type LinearErrorCode,
  type SyncLinearRequest,
} from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";
import { desktopBridge } from "@web/lib/desktop-bridge";

class LinearOperationError extends Error {
  constructor(
    message: string,
    readonly code: LinearErrorCode | null,
  ) {
    super(message);
    this.name = "LinearOperationError";
  }
}

function linearRefusal(error: unknown): { code: LinearErrorCode; message: string } | null {
  if (error instanceof LinearOperationError && error.code !== null) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof DaemonRequestError) {
    const refusal = linearErrorSchema.safeParse(error.body);
    if (refusal.success) {
      return { code: refusal.data.error, message: refusal.data.message };
    }
  }
  return null;
}

export function isSupersededLinearError(error: unknown): boolean {
  return linearRefusal(error)?.code === "linear_request_superseded";
}

export function useConnectLinear() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (apiKey: string) => {
      const bridge = desktopBridge();
      if (bridge === null) {
        const connection = await daemon.connectLinear({ api_key: apiKey });
        if (connection.status !== "connected") {
          throw new LinearOperationError(
            connection.error_message ?? "Linear rejected the API key.",
            connection.error_code,
          );
        }
        return;
      }
      const result = await bridge.linear.saveKey(apiKey);
      if (!result.ok) throw new LinearOperationError(result.message, result.error_code);
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.linear }),
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
      if (!result.ok) throw new LinearOperationError(result.message, result.error_code);
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.linear }),
    onError: (error) => {
      if (!isSupersededLinearError(error)) toast.error(linearErrorMessage(error));
    },
  });
}

export function useCreateIssueSource() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateIssueSourceRequest) => daemon.createIssueSource(request),
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.linear }),
  });
}

export function useSyncLinear() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: SyncLinearRequest = {}) => daemon.syncLinear(request),
    onSuccess: (response) => {
      let imported = 0;
      let updated = 0;
      for (const syncResult of response.results) {
        imported += syncResult.imported;
        updated += syncResult.updated;
      }
      toast.success(`Synced Linear — ${imported} imported, ${updated} updated.`);
    },
    onError: (error) => {
      if (!isSupersededLinearError(error)) toast.error(linearErrorMessage(error));
    },
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.linearConnection }),
        client.invalidateQueries({ queryKey: queryKeys.issueSources }),
        client.invalidateQueries({ queryKey: queryKeys.issues }),
      ]);
    },
  });
}

export function linearErrorMessage(error: unknown): string {
  const refusal = linearRefusal(error);
  if (refusal !== null) return refusal.message;
  if (error instanceof DaemonRequestError) {
    return "The daemon rejected the Linear request.";
  }
  return error instanceof Error ? error.message : "Could not reach the daemon.";
}
