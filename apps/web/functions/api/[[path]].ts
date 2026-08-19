import { PREVIEW_MANIFEST_PATH } from "@otomat/domain";

/**
 * Same-origin façade for a web preview: `/api/*` is proxied to the pull request's own daemon
 * through its named Cloudflare Tunnel, so the browser only ever talks to one Access-protected
 * origin. Nothing of the browser's request identity crosses over — no `Origin`, no `Cookie`, no
 * `Host` — which is why the daemon keeps its loopback CORS and `Host` guard unchanged.
 */

interface PreviewEnv {
  /** Tunnel hostname pattern such as `otomat-pr-{pr}.preview.example.com`, shared with the provisioning script. */
  OTOMAT_PREVIEW_DAEMON_HOSTNAME?: string;
  /** Access service token for the machine-to-machine hop; the browser never holds it. */
  OTOMAT_PREVIEW_ACCESS_CLIENT_ID?: string;
  OTOMAT_PREVIEW_ACCESS_CLIENT_SECRET?: string;
  ASSETS: { fetch(input: URL): Promise<Response> };
}

interface PagesContext {
  request: Request;
  env: PreviewEnv;
}

/** Everything the daemon needs to answer; anything else would either leak identity or be ignored. */
const FORWARDED_HEADERS = ["accept", "content-type", "last-event-id", "cache-control"];

// A deployment's manifest never changes, so each isolate reads it once. `undefined` is "not read yet".
let cachedOrigin: string | null | undefined;

function refusal(error: string, message: string, status: number): Response {
  return Response.json({ error, message }, { status });
}

function pullRequestOf(manifest: unknown): number | null {
  if (typeof manifest !== "object" || manifest === null) return null;
  // SAFETY: narrowed to a non-null object above; the field is validated on the next line.
  const value = (manifest as { pull_request?: unknown }).pull_request;
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

async function daemonOrigin(context: PagesContext): Promise<string | null> {
  if (cachedOrigin !== undefined) return cachedOrigin;
  const template = context.env.OTOMAT_PREVIEW_DAEMON_HOSTNAME;
  if (template === undefined || template === "") {
    cachedOrigin = null;
    return cachedOrigin;
  }
  const manifest = await context.env.ASSETS.fetch(
    new URL(PREVIEW_MANIFEST_PATH, context.request.url),
  );
  const pullRequest = manifest.ok ? pullRequestOf(await manifest.json()) : null;
  cachedOrigin =
    pullRequest === null ? null : `https://${template.replace("{pr}", String(pullRequest))}`;
  return cachedOrigin;
}

function upstreamHeaders(context: PagesContext): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = context.request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  const id = context.env.OTOMAT_PREVIEW_ACCESS_CLIENT_ID;
  const secret = context.env.OTOMAT_PREVIEW_ACCESS_CLIENT_SECRET;
  if (id !== undefined && secret !== undefined) {
    headers.set("CF-Access-Client-Id", id);
    headers.set("CF-Access-Client-Secret", secret);
  }
  return headers;
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const origin = await daemonOrigin(context);
  if (origin === null) {
    return refusal(
      "preview_daemon_unavailable",
      "No daemon instance is routed for this preview yet.",
      503,
    );
  }
  const incoming = new URL(context.request.url);
  try {
    // The upstream Response is returned as-is so an SSE body keeps streaming instead of buffering.
    return await fetch(new URL(`${incoming.pathname}${incoming.search}`, origin), {
      method: context.request.method,
      headers: upstreamHeaders(context),
      body: context.request.body,
      redirect: "manual",
    });
  } catch (error) {
    return refusal(
      "preview_daemon_unreachable",
      `The preview daemon at ${origin} did not answer: ${error instanceof Error ? error.message : String(error)}`,
      502,
    );
  }
}
