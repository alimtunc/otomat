/** Cockpit renderer↔main channels. Kept electron-free so the preload can import them without pulling in main-only code. */
export const DAEMON_URL_CHANNEL = "otomat:daemon-url";
export const PICK_DIRECTORY_CHANNEL = "otomat:pick-directory";
export const LINEAR_SAVE_KEY_CHANNEL = "otomat:linear-save-key";
export const LINEAR_FORGET_KEY_CHANNEL = "otomat:linear-forget-key";
export const EXECUTION_HOST_SYNC_CHANNEL = "otomat:execution-host-sync";
export const EXECUTION_HOST_SNAPSHOT_CHANNEL = "otomat:execution-host-snapshot";
export const EXECUTION_HOST_SELECT_CHANNEL = "otomat:execution-host-select";
export const EXECUTION_HOST_CONFIGURE_CHANNEL = "otomat:execution-host-configure";
export const EXECUTION_HOST_ALIASES_CHANNEL = "otomat:execution-host-aliases";
export const EXECUTION_HOST_STATUS_CHANNEL = "otomat:execution-host-status";
