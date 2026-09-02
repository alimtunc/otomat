import { DaemonRequestError } from "@otomat/client";
import {
  linearErrorSchema,
  type ConnectLinearRequest,
  type CreateIssueSourceRequest,
  type LinearConnectionContract,
  type LinearErrorCode,
  type UpdateIssueSourceRequest,
} from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useQueryKeys } from "@web/api/use-query-keys";
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

/** On the desktop the vault owns the key and fans it out; the browser build talks to its own daemon. */
export function useConnectLinear() {
  const keys = useQueryKeys();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (request: ConnectLinearRequest) => {
      const bridge = desktopBridge();
      if (bridge === null) return daemon.connectLinear(request);
      const result = await bridge.linear.saveKey(request);
      if (!result.ok) throw new LinearOperationError(result.message, result.error_code);
      return null;
    },
    onSuccess: (connection) => {
      if (connection === null) return;
      client.setQueryData<LinearConnectionContract[]>(keys.linearConnections, (connections = []) =>
        connections.some((candidate) => candidate.id === connection.id)
          ? connections.map((candidate) =>
              candidate.id === connection.id ? connection : candidate,
            )
          : [...connections, connection],
      );
    },
    onSettled: () => client.invalidateQueries({ queryKey: keys.linear }),
  });
}

export function useDisconnectLinear() {
  const keys = useQueryKeys();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (connectionId: string) => {
      const bridge = desktopBridge();
      if (bridge === null) {
        await daemon.disconnectLinear(connectionId);
        return;
      }
      const result = await bridge.linear.forgetKey(connectionId);
      if (!result.ok) throw new LinearOperationError(result.message, result.error_code);
    },
    onSettled: () => client.invalidateQueries({ queryKey: keys.linear }),
    onError: (error) => {
      if (!isSupersededLinearError(error)) toast.error(linearErrorMessage(error));
    },
  });
}

export function useCreateIssueSource() {
  const keys = useQueryKeys();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateIssueSourceRequest) => daemon.createIssueSource(request),
    onSettled: () => client.invalidateQueries({ queryKey: keys.linear }),
  });
}

export function useUpdateIssueSource() {
  const keys = useQueryKeys();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (variables: { sourceId: string; request: UpdateIssueSourceRequest }) =>
      daemon.updateIssueSource(variables.sourceId, variables.request),
    onSuccess: () => toast.success("Updated the Linear status mapping."),
    onError: (error) => toast.error(linearErrorMessage(error)),
    onSettled: () => client.invalidateQueries({ queryKey: keys.linear }),
  });
}

export function useReconcileIssueSource() {
  const keys = useQueryKeys();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (sourceId: string) => daemon.reconcileIssueSource(sourceId),
    onSuccess: (result) => {
      if (result.reconciled === 0 && result.failed === 0) {
        toast.info("No linked issue has an open workspace to reconcile.");
        return;
      }
      if (result.failed > 0) {
        toast.error(
          `Reconciled ${result.reconciled} issue(s); ${result.failed} failed — retry from the issue.`,
        );
        return;
      }
      toast.success(`Reconciled ${result.reconciled} issue(s) with an open workspace.`);
    },
    onError: (error) => toast.error(linearErrorMessage(error)),
    onSettled: () => client.invalidateQueries({ queryKey: keys.linear }),
  });
}

export function useDeleteIssueSource() {
  const keys = useQueryKeys();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (sourceId: string) => daemon.deleteIssueSource(sourceId),
    onSuccess: () => toast.success("Source unmapped — its issues stop syncing."),
    onError: (error) => toast.error(linearErrorMessage(error)),
    onSettled: () => client.invalidateQueries({ queryKey: keys.linear }),
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
