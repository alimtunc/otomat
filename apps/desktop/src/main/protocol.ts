import { statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";

import { protocol } from "electron";

import { APP_SCHEME } from "#shared/constants";

const MIME_BY_EXT: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".map": "application/json",
};

/** Must run before `app.whenReady()`: marks the scheme secure + CORS-enabled so the renderer behaves like a normal https origin. */
export function registerAppSchemePrivileged(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

function contentType(file: string): string {
  return MIME_BY_EXT[extname(file).toLowerCase()] ?? "application/octet-stream";
}

function isFile(candidate: string): boolean {
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
}

/** Resolves `pathname` under `root`, rejecting any `..` escape outside the served dir. */
function resolveWithinRoot(root: string, pathname: string): string | null {
  const candidate = normalize(join(root, decodeURIComponent(pathname)));
  const rootWithSep = root.endsWith(sep) ? root : root + sep;
  if (candidate !== root && !candidate.startsWith(rootWithSep)) return null;
  return candidate;
}

/**
 * Serves the packaged web build over the app scheme with a browser-history SPA fallback:
 * a real asset is returned as-is, any other path returns `index.html` so deep-link refreshes
 * work. `cspFor` is read per request so a retry that picked a new daemon port gets a fresh CSP.
 */
export function serveAppScheme(webDist: string, cspFor: () => string): void {
  protocol.handle(APP_SCHEME, async (request) => {
    const requested = resolveWithinRoot(webDist, new URL(request.url).pathname);
    const file = requested !== null && isFile(requested) ? requested : join(webDist, "index.html");
    const body = await readFile(file);
    return new Response(new Uint8Array(body), {
      status: 200,
      headers: {
        "content-type": contentType(file),
        "content-security-policy": cspFor(),
        "x-content-type-options": "nosniff",
      },
    });
  });
}
