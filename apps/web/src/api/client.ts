import { createDaemonClient } from "@otomat/client";

/** Empty base targets the same origin; Vite proxies `/api` to the local daemon in dev. */
const baseUrl = import.meta.env.VITE_OTOMAT_DAEMON_URL ?? "";

export const daemon = createDaemonClient({ baseUrl });
