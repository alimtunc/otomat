import { desktopBridge } from "@web/lib/desktop-bridge";
import { useEffect, useState } from "react";

const RECHECK_INTERVAL_MS = 15_000;

/**
 * True while the active host's daemon runs a different build than this app
 * expects. New runs pause behind it: launching would keep the stale daemon busy
 * and starve the automatic idle restart, on top of speaking a newer API than
 * the daemon knows. Always false in the browser, where there is one daemon.
 */
export function useDaemonUpdatePending(): boolean {
  const bridge = desktopBridge();
  const [pending, setPending] = useState(false);

  // otomat-allow-effect: polls the main process's host snapshot and re-checks on its status pushes; detaches on unmount.
  useEffect(() => {
    if (bridge === null) return;
    let disposed = false;
    const check = async (): Promise<void> => {
      try {
        const snapshot = await bridge.executionHost.snapshot();
        if (disposed) return;
        setPending(
          snapshot.active_id === "remote" &&
            snapshot.remote_build !== null &&
            snapshot.expected_build !== null &&
            snapshot.remote_build !== snapshot.expected_build,
        );
      } catch {
        if (!disposed) setPending(false);
      }
    };
    void check();
    const unsubscribe = bridge.executionHost.onRemoteStatus(() => void check());
    const timer = setInterval(() => void check(), RECHECK_INTERVAL_MS);
    return () => {
      disposed = true;
      unsubscribe();
      clearInterval(timer);
    };
  }, [bridge]);

  return bridge === null ? false : pending;
}
