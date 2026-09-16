import { shell, type Session, type WebContents } from "electron";

import { APP_ORIGIN, DEV_SERVER_ENV } from "#shared/constants";

/** Origins a renderer may navigate within: the packaged app scheme, or the dev server's. */
export function resolveAllowedOrigins(
  devServer: string | null,
  log: (message: string) => void,
): string[] {
  if (devServer === null) return [APP_ORIGIN];
  try {
    return [new URL(devServer).origin];
  } catch (error) {
    log(`Ignored an invalid ${DEV_SERVER_ENV} value: ${String(error)}`);
    return [];
  }
}

function isSafeExternal(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

// Node's URL reports an opaque "null" origin for the custom app scheme, so match by prefix.
function withinAllowedOrigin(url: string, allowedOrigins: readonly string[]): boolean {
  return allowedOrigins.some((origin) => url === origin || url.startsWith(`${origin}/`));
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
    if (withinAllowedOrigin(url, allowedOrigins)) return;
    event.preventDefault();
    if (isSafeExternal(url)) void shell.openExternal(url);
  });
}

// The copy buttons need the sanitized clipboard write; notifications are raised from main.
const RENDERER_PERMISSION_ALLOWLIST: ReadonlySet<string> = new Set(["clipboard-sanitized-write"]);

export function denyRendererPermissions(
  session: Pick<Session, "setPermissionRequestHandler" | "setPermissionCheckHandler">,
  allowedOrigins: readonly string[],
  log: (message: string) => void,
): void {
  const decide = (permission: string, url: string): boolean => {
    const allowed =
      RENDERER_PERMISSION_ALLOWLIST.has(permission) && withinAllowedOrigin(url, allowedOrigins);
    if (!allowed) log(`Denied renderer permission "${permission}" for ${url}`);
    return allowed;
  };

  session.setPermissionRequestHandler((_contents, permission, callback, details) =>
    callback(decide(permission, details.requestingUrl)),
  );
  session.setPermissionCheckHandler((_contents, permission, requestingOrigin) =>
    decide(permission, requestingOrigin),
  );
}
