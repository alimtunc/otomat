/**
 * Strict CSP for the packaged renderer. `connect-src` must include the daemon origin so the
 * cockpit can call the API and open the SSE stream cross-origin; everything else is locked to
 * the app scheme (`'self'`). `style-src` allows inline styles because component libraries inject
 * them; scripts stay `'self'` only (no inline/eval — the Vite production build needs neither).
 */
export function buildCsp(daemonOrigin: string): string {
  return [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${daemonOrigin}`,
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}
