import { createDaemonClient } from "@otomat/client";
import { desktopBridge } from "@web/lib/desktop-bridge";

/**
 * Desktop shell injects the daemon's dynamic loopback origin at runtime; the browser falls
 * back to the build-time env, and an empty base targets the same origin (Vite proxies `/api`).
 */
const baseUrl = desktopBridge()?.daemonUrl ?? import.meta.env.VITE_OTOMAT_DAEMON_URL ?? "";

export const daemon = createDaemonClient({ baseUrl });
