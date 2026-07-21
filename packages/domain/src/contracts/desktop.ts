import type { LinearErrorCode } from "./linear.js";

export type LinearVaultOperationResult =
  | { ok: true; message: null }
  | { ok: false; message: string; error_code: LinearErrorCode | null };

/**
 * The narrow surface the Electron desktop shell exposes to the renderer through
 * `contextBridge` as `window.otomat`. Absent in the browser (dev/web), where the
 * daemon URL comes from the build-time env and there is no native folder picker.
 */
export interface OtomatDesktopBridge {
  /** Origin of the daemon the desktop shell launched (dynamic loopback port). */
  readonly daemonUrl: string;
  /** Opens the native directory chooser; resolves to the absolute path, or null when canceled. */
  pickDirectory(): Promise<string | null>;
  linear: {
    saveKey(apiKey: string): Promise<LinearVaultOperationResult>;
    forgetKey(): Promise<LinearVaultOperationResult>;
  };
}
