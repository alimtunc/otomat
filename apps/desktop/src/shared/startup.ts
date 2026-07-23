import type { DesktopStartupDiagnostic } from "@otomat/domain";

/** IPC channels + payload the main process uses to drive the splash window's startup states. */
export const SPLASH_STATUS_CHANNEL = "otomat:splash-status";
export const SPLASH_RETRY_CHANNEL = "otomat:splash-retry";
export const SPLASH_RESTORE_CHANNEL = "otomat:splash-restore";
export const SPLASH_EXPORT_SUPPORT_CHANNEL = "otomat:splash-export-support";
export const SPLASH_SHOW_POLICY_CHANNEL = "otomat:splash-show-policy";

/** Honest startup states: never "connected" until the daemon has answered `/api/health`. */
export type StartupStatus =
  | { phase: "launching" }
  | { phase: "restoring" }
  | { phase: "failed"; diagnostic: DesktopStartupDiagnostic };
