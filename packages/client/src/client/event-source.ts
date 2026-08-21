import type { DaemonClientConfig, DaemonEventSource } from "./config.js";
import { resolveUrl } from "./http.js";

/** Throws rather than degrading: a platform without SSE has to be configured, not silently left without live updates. */
export function openEventSource(config: DaemonClientConfig, path: string): DaemonEventSource {
  // SAFETY: probes the ambient global, which platforms without SSE leave undefined.
  const Source =
    config.EventSource ?? (globalThis as { EventSource?: typeof EventSource }).EventSource;
  if (!Source) {
    throw new Error("EventSource is unavailable in this environment; pass config.EventSource");
  }
  return new Source(resolveUrl(config, path));
}

/** EventSource swallows listener throws, so a frame that fails validation is surfaced instead of silently gapping the stream. */
export function deliverFrame<T>(
  event: Event,
  schema: { parse(raw: unknown): T },
  handle: (value: T) => void,
  onParseError?: (error: unknown) => void,
): void {
  try {
    // SAFETY: named SSE events arrive as MessageEvents carrying the frame payload in data.
    handle(schema.parse(JSON.parse((event as MessageEvent).data)));
  } catch (error) {
    if (onParseError) onParseError(error);
    else console.error("[otomat] SSE frame failed to parse", error);
  }
}
