/**
 * The narrow, validated surface the Electron desktop shell exposes to the renderer
 * through `contextBridge` as `window.otomat`. Absent in the browser (dev/web), where the
 * daemon URL comes from the build-time env and there is no native folder picker.
 */
/** Whether a Linear key can be stored on this machine and whether one already is. The key itself is never readable. */
export interface LinearVaultStatus {
  encryption_available: boolean;
  has_stored_key: boolean;
}

export interface LinearVaultResult {
  ok: boolean;
  message: string | null;
}

export interface OtomatDesktopBridge {
  /** Origin of the daemon the desktop shell launched (dynamic loopback port). */
  readonly daemonUrl: string;
  /** Opens the native directory chooser; resolves to the absolute path, or null when canceled. */
  pickDirectory(): Promise<string | null>;
  /** Encrypted-at-rest Linear key handling. Write-only: nothing here returns a stored key. */
  linear: {
    vaultStatus(): Promise<LinearVaultStatus>;
    saveKey(apiKey: string): Promise<LinearVaultResult>;
    forgetKey(): Promise<LinearVaultResult>;
  };
}

declare global {
  interface Window {
    otomat?: OtomatDesktopBridge;
  }
}

/** The desktop bridge when running inside the packaged/dev Electron app; null in a plain browser. */
export function desktopBridge(): OtomatDesktopBridge | null {
  return typeof window === "undefined" ? null : (window.otomat ?? null);
}
