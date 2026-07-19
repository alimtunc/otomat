/** IPC channels + payload the main process uses to drive the splash window's startup states. */
export const SPLASH_STATUS_CHANNEL = "otomat:splash-status";
export const SPLASH_RETRY_CHANNEL = "otomat:splash-retry";

/** Honest startup states: never "connected" until the daemon has answered `/api/health`. */
export type StartupStatus = { phase: "launching" } | { phase: "failed"; message: string };
