import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@web/api/query-keys";
import { describeOperationFailure } from "@web/components/shell/remote-session/status-labels";
import { desktopBridge, requireDesktopBridge } from "@web/lib/desktop-bridge";

export interface UseDaemonUpdateResult {
  running: boolean;
  /** Why the retry itself was refused; the host's own failure rides on the session state. */
  error: string | null;
  retry(): void;
}

/** The manual retry of the update the host runs by itself: the same install, asked for now. */
export function useDaemonUpdate(): UseDaemonUpdateResult {
  const bridge = desktopBridge();
  const client = useQueryClient();
  const update = useMutation({
    mutationFn: () => requireDesktopBridge(bridge).executionHost.updateRemoteDaemon(),
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.executionHost }),
  });

  let error: string | null = null;
  if (update.error !== null) error = update.error.message;
  else if (update.data?.ok === false) error = describeOperationFailure(update.data);

  return {
    running: update.isPending,
    error,
    retry: () => update.mutate(),
  };
}
