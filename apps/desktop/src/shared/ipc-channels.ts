/** Cockpit renderer↔main channels. Kept electron-free so the preload can import them without pulling in main-only code. */
export const DAEMON_URL_CHANNEL = "otomat:daemon-url";
export const PICK_DIRECTORY_CHANNEL = "otomat:pick-directory";
export const LINEAR_SAVE_KEY_CHANNEL = "otomat:linear-save-key";
export const LINEAR_FORGET_KEY_CHANNEL = "otomat:linear-forget-key";
