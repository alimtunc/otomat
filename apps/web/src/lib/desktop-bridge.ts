import type { OtomatDesktopBridge } from "@otomat/domain";

declare global {
  interface Window {
    otomat?: OtomatDesktopBridge;
  }
}

/** The desktop bridge when running inside the packaged/dev Electron app; null in a plain browser. */
export function desktopBridge(): OtomatDesktopBridge | null {
  return typeof window === "undefined" ? null : (window.otomat ?? null);
}
