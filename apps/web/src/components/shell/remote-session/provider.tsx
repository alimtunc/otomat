import { isRemoteHostSettling, type RemoteHostStatus } from "@otomat/domain";
import { useQueryClient } from "@tanstack/react-query";
import { hostKeys, shellKeys } from "@web/api/query-keys";
import {
  RemoteSessionContext,
  LOCAL_SESSION,
  type RemoteSessionState,
} from "@web/components/shell/remote-session/context";
import { useHostSnapshot } from "@web/components/shell/remote-session/use-host-snapshot";
import { useActiveHostId } from "@web/lib/active-host";
import { desktopBridge } from "@web/lib/desktop-bridge";
import { useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * The one subscription to the shell's host status, mounted for every route: a remote bootstrap can
 * take half a minute, and each surface has to be able to tell that from a daemon that is gone.
 */
export function RemoteSessionProvider({ children }: { children: ReactNode }) {
  const bridge = desktopBridge();
  const client = useQueryClient();
  const snapshot = useHostSnapshot();
  const active = useActiveHostId() === "remote";
  const [pushed, setPushed] = useState<RemoteHostStatus | null>(null);

  // otomat-allow-effect: subscribe to the main process's remote-status push channel and detach on unmount.
  useEffect(() => {
    if (bridge === null) return;
    return bridge.executionHost.onRemoteStatus((status) => {
      setPushed(status);
      void client.invalidateQueries({ queryKey: shellKeys.executionHost });
      if (status.phase === "connected") {
        void client.invalidateQueries({ queryKey: hostKeys("remote").host });
      }
    });
  }, [bridge, client]);

  const host = snapshot.data;
  const status = pushed ?? host?.remote_status ?? null;
  const alias = host?.remote_ssh_alias ?? null;
  const build = host?.remote_build ?? null;
  const expectedBuild = host?.expected_build ?? null;
  const updateError = host?.remote_update_error ?? null;
  const value = useMemo<RemoteSessionState>(() => {
    const stale = build !== null && expectedBuild !== null && build !== expectedBuild;
    return {
      active,
      alias,
      status,
      settling: active && isRemoteHostSettling(status),
      build,
      expectedBuild,
      stale,
      updatePending: active && stale,
      updateError,
    };
  }, [active, alias, status, build, expectedBuild, updateError]);

  return (
    <RemoteSessionContext.Provider value={bridge === null ? LOCAL_SESSION : value}>
      {children}
    </RemoteSessionContext.Provider>
  );
}
