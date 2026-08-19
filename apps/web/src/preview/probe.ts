import { createDaemonClient, DaemonRequestError, DaemonTransportError } from "@otomat/client";

export type PreviewProbe =
  | { kind: "unavailable" }
  | { kind: "starting" }
  | { kind: "ready"; build: string | null }
  | { kind: "unreadable"; detail: string };

/** The façade answers as soon as it knows; a longer bound would only delay the sandbox a starting instance falls back to. */
const PROBE_TIMEOUT_MS = 2_000;

/** The preview plumbing's own refusals — no usable daemon hop — distinct from a daemon that is merely down. */
const PREVIEW_REFUSALS = new Set([
  "preview_daemon_unavailable",
  "preview_access_unconfigured",
  "preview_access_denied",
  "preview_client_unauthorized",
]);

function isUnroutedInstance(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  // SAFETY: narrowed to a non-null object above; the property read is what decides the shape.
  const error = (body as { error?: unknown }).error;
  return typeof error === "string" && PREVIEW_REFUSALS.has(error);
}

export async function probePreviewDaemon(fetchImpl: typeof fetch = fetch): Promise<PreviewProbe> {
  const client = createDaemonClient({
    fetch: (input, init) =>
      fetchImpl(input, { ...init, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) }),
  });
  try {
    return { kind: "ready", build: (await client.health()).build };
  } catch (error) {
    if (error instanceof DaemonRequestError) {
      return isUnroutedInstance(error.body) ? { kind: "unavailable" } : { kind: "starting" };
    }
    if (error instanceof DaemonTransportError) return { kind: "starting" };
    return { kind: "unreadable", detail: error instanceof Error ? error.message : String(error) };
  }
}
