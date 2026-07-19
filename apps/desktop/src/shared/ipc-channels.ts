/** Cockpit renderer↔main channels. Kept electron-free so the preload can import them without pulling in main-only code. */
export const DAEMON_URL_CHANNEL = "otomat:daemon-url";
export const PICK_DIRECTORY_CHANNEL = "otomat:pick-directory";
