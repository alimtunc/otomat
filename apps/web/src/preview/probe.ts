import { createDaemonClient, DaemonRequestError, DaemonTransportError } from "@otomat/client";

export type PreviewProbe =
  | { kind: "unavailable" }
  | { kind: "starting" }
  | { kind: "ready"; build: string | null }
  | { kind: "unreadable"; detail: string };

/** The façade answers as soon as it knows; a longer bound would only delay the sandbox a starting instance falls back to. */
const PROBE_TIMEOUT_MS = 2_000;

/** The façade's own refusal while no instance is routed for this pull request, distinct from a daemon that is merely down. */
function isUnroutedInstance(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  // SAFETY: narrowed to a non-null object above; the property read is what decides the shape.
  return (body as { error?: unknown }).error === "preview_daemon_unavailable";
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
