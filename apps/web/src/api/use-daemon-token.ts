import { desktopBridge } from "@web/lib/desktop-bridge";
import { useSyncExternalStore } from "react";

const noSubscription = (): (() => void) => () => {};
const noToken = (): string => "";

/** A daemon answers a superseded token with 401, which ends an EventSource for good: streams reopen on this. */
export function useDaemonToken(): string {
  const bridge = desktopBridge();
  return useSyncExternalStore(
    bridge?.onDaemonToken ?? noSubscription,
    bridge?.daemonToken ?? noToken,
  );
}
