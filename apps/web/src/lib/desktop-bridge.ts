import type { OtomatDesktopBridge } from "@otomat/domain";

declare global {
  interface Window {
    otomat?: OtomatDesktopBridge;
  }
}

export function desktopBridge(): OtomatDesktopBridge | null {
  return typeof window === "undefined" ? null : (window.otomat ?? null);
}

export function requireDesktopBridge(bridge: OtomatDesktopBridge | null): OtomatDesktopBridge {
  if (bridge === null) throw new Error("The desktop bridge is not available.");
  return bridge;
}
