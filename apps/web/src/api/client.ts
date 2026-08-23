import { createDaemonClient } from "@otomat/client";
import { desktopBridge } from "@web/lib/desktop-bridge";
import { previewSession } from "@web/preview/session";

/** An empty base targets the same origin: Vite proxies `/api`, and a web preview's façade serves it. */
const baseUrl = desktopBridge()?.daemonUrl ?? import.meta.env.VITE_OTOMAT_DAEMON_URL ?? "";

const preview = previewSession();

export const daemon = createDaemonClient(
  preview?.state === "sandbox" ? preview.transport : { baseUrl },
);
