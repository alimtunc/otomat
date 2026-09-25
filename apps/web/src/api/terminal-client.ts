import { createDaemonClient } from "@otomat/client";
import { activeHost } from "@web/lib/active-host";
import { desktopBridge, requireDesktopBridge } from "@web/lib/desktop-bridge";

export function captureTerminalClient() {
  const baseUrl = activeHost().daemonUrl;
  const token = requireDesktopBridge(desktopBridge()).daemonToken();
  return createDaemonClient({
    baseUrl,
    token,
    fetch: (url, init) => {
      if (activeHost().daemonUrl !== baseUrl || desktopBridge()?.daemonToken() !== token)
        return Promise.reject(new Error("The selected host changed. Reopen the terminal tab."));
      return fetch(url, { ...init, signal: AbortSignal.timeout(5000) });
    },
  });
}
