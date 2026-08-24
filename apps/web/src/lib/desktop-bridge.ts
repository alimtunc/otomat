import type { ExecutionHostId, OtomatDesktopBridge } from "@otomat/domain";

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

export function activeExecutionHostId(): ExecutionHostId {
  return desktopBridge()?.executionHostId ?? "local";
}

export function remoteHostAlias(): string | null {
  const bridge = desktopBridge();
  return bridge !== null && bridge.executionHostId === "remote"
    ? bridge.executionHostSshAlias
    : null;
}
