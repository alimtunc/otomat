import { createDaemonClient } from "@otomat/client";
import { activeHost } from "@web/lib/active-host";
import { desktopBridge, requireDesktopBridge } from "@web/lib/desktop-bridge";
import { previewSession } from "@web/preview/session";

export function userTerminalsAvailable(): boolean {
  return desktopBridge() !== null && previewSession() === null;
}

/** Opening and preparing wait on the project's launch queue, so they alone run without a timeout. */
export function captureTerminalClient() {
  const baseUrl = activeHost().daemonUrl;
  const token = requireDesktopBridge(desktopBridge()).daemonToken();
  return createDaemonClient({
    baseUrl,
    token,
    fetch: (url, init) => {
      if (activeHost().daemonUrl !== baseUrl || desktopBridge()?.daemonToken() !== token)
        return Promise.reject(new Error("The selected host changed. Reopen the terminal tab."));
      const path = new URL(url instanceof Request ? url.url : url).pathname;
      const queued =
        init?.method === "POST" &&
        (path === "/api/terminals" || path.startsWith("/api/workspaces/prepare/"));
      if (queued) return fetch(url, init);
      const timeout = AbortSignal.timeout(5000);
      const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
      return fetch(url, { ...init, signal });
    },
  });
}
