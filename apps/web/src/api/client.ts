import { createDaemonClient } from "@otomat/client";
import { activeHost } from "@web/lib/active-host";
import { desktopBridge } from "@web/lib/desktop-bridge";
import { previewSession } from "@web/preview/session";

/** An empty base targets the same origin: Vite proxies `/api`, and a web preview's façade serves it. */
const buildBaseUrl = import.meta.env.VITE_OTOMAT_DAEMON_URL ?? "";

const preview = previewSession();

/** Resolved per request: a host switch re-points the one client instead of reloading the renderer. */
const baseUrl = (): string => {
  const url = activeHost().daemonUrl;
  return url === "" ? buildBaseUrl : url;
};

/** Outside the desktop shell the Vite proxy or the preview façade holds the daemon's token. */
const token = (): string => desktopBridge()?.daemonToken() ?? "";

export const daemon = createDaemonClient(
  preview?.state === "sandbox" ? preview.transport : { baseUrl, token },
);
