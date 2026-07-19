import { shell, type WebContents } from "electron";

function isSafeExternal(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Locks a renderer down: window.open / target=_blank never spawns an Electron window (safe
 * http/https links go to the system browser), and a full navigation away from an allowed origin
 * is cancelled — the SPA router's in-page transitions never trigger `will-navigate`.
 */
export function hardenWebContents(contents: WebContents, allowedOrigins: readonly string[]): void {
  contents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternal(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  contents.on("will-navigate", (event, url) => {
    const origin = originOf(url);
    if (origin !== null && allowedOrigins.includes(origin)) return;
    event.preventDefault();
    if (isSafeExternal(url)) void shell.openExternal(url);
  });
}
