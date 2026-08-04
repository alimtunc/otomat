import type { OtomatDesktopBridge } from "@otomat/domain";

declare global {
  interface Window {
    otomat?: OtomatDesktopBridge;
  }
}

export function desktopBridge(): OtomatDesktopBridge | null {
  return typeof window === "undefined" ? null : (window.otomat ?? null);
}

/** SSH alias of the active remote execution host; null when this load runs against the local daemon (or no bridge). */
export function remoteHostAlias(): string | null {
  const bridge = desktopBridge();
  return bridge !== null && bridge.executionHostId === "remote"
    ? bridge.executionHostSshAlias
    : null;
}
