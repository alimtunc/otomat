/**
 * Strict CSP for the packaged renderer. `connect-src` must include every daemon origin the cockpit
 * can switch to without a reload — the local daemon and the tunnel's local end — so it can call
 * the API and open the SSE stream cross-origin; everything else is locked to the app scheme
 * (`'self'`). `style-src` allows inline styles because component libraries inject them; scripts
 * stay `'self'` only (no inline/eval — the Vite production build needs neither).
 */
function buildCsp(daemonOrigins: readonly string[]): string {
  return [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${daemonOrigins.join(" ")}`.trimEnd(),
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** A host switch re-points the renderer in place only to an origin the served document's policy named. */
export class RendererCsp {
  private served: readonly string[] | null = null;

  constructor(private readonly daemonUrls: () => Array<string | null>) {}

  /** Read per request; only the document response's policy binds the page. */
  headerFor(document: boolean): string {
    const origins = this.daemonUrls().filter((url): url is string => url !== null && url !== "");
    if (document) this.served = origins;
    return buildCsp(origins);
  }

  allows(url: string): boolean {
    return this.served === null || this.served.includes(url);
  }
}
