import {
  eventEnvelopeSchema,
  runEndPayloadSchema,
  runStreamErrorPayloadSchema,
  type EventEnvelope,
  type RunEndPayload,
  type RunStreamErrorPayload,
} from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { resolveUrl } from "./http.js";

export interface RunEventsHandlers {
  /** Resume cursor: only events with `seq` greater than this are delivered. */
  afterSeq?: number;
  onEvent(event: EventEnvelope): void;
  onOpen?(): void;
  onEnd?(payload: RunEndPayload): void;
  /** A server-side stream failure (the run itself may still be running); the stream is closed. */
  onStreamError?(payload: RunStreamErrorPayload): void;
  /** A transport-level EventSource error; EventSource may still reconnect. */
  onError?(error: Event): void;
  /** An SSE frame that failed `JSON.parse`/schema validation (e.g. daemon/web contract drift). */
  onParseError?(error: unknown): void;
}

export interface RunEventsSubscription {
  close(): void;
}

/**
 * Opens an SSE stream of a run's events, routing each named frame to its handler.
 * Throws synchronously when no `EventSource` is available (neither global nor
 * `config.EventSource`). `handlers.afterSeq` is sent as a resume cursor so only events
 * after it replay. Each frame is schema-validated; a parse failure is routed to
 * `onParseError` (or logged) instead of throwing into EventSource, so the timeline
 * never silently gaps. `end` and `stream_error` are terminal and close the stream; a
 * transport `error` reaches `onError` while EventSource keeps auto-reconnecting. The
 * returned subscription's `close()` stops the stream and any further reconnection.
 */
export function subscribeRunEvents(
  config: DaemonClientConfig,
  runId: string,
  handlers: RunEventsHandlers,
): RunEventsSubscription {
  const Source =
    config.EventSource ?? (globalThis as { EventSource?: typeof EventSource }).EventSource;
  if (!Source) {
    throw new Error("EventSource is unavailable in this environment; pass config.EventSource");
  }

  const query = handlers.afterSeq === undefined ? "" : `?afterSeq=${handlers.afterSeq}`;
  const url = resolveUrl(config, `/api/runs/${encodeURIComponent(runId)}/events${query}`);
  const source = new Source(url);

  // EventSource swallows listener throws, so parse failures are surfaced instead of silently gapping the timeline.
  const deliver = <T>(
    event: Event,
    schema: { parse(raw: unknown): T },
    handle: (value: T) => void,
  ): void => {
    try {
      handle(schema.parse(JSON.parse((event as MessageEvent).data)));
    } catch (error) {
      if (handlers.onParseError) handlers.onParseError(error);
      else console.error("[otomat] SSE frame failed to parse", error);
    }
  };

  source.addEventListener("event", (event) =>
    deliver(event, eventEnvelopeSchema, (value) => handlers.onEvent(value)),
  );
  source.addEventListener("end", (event) => {
    deliver(event, runEndPayloadSchema, (value) => handlers.onEnd?.(value));
    source.close();
  });
  source.addEventListener("stream_error", (event) => {
    deliver(event, runStreamErrorPayloadSchema, (value) => handlers.onStreamError?.(value));
    source.close();
  });
  source.addEventListener("open", () => handlers.onOpen?.());
  source.addEventListener("error", (event) => handlers.onError?.(event));

  return { close: () => source.close() };
}
