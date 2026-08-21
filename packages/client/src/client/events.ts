import {
  eventEnvelopeSchema,
  runEndPayloadSchema,
  runStreamErrorPayloadSchema,
  type EventEnvelope,
  type RunEndPayload,
  type RunStreamErrorPayload,
} from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { deliverFrame, openEventSource } from "./event-source.js";

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
 * `handlers.afterSeq` is sent as a resume cursor so only events after it replay.
 * `end` and `stream_error` are terminal and close the stream; a transport `error`
 * reaches `onError` while EventSource keeps auto-reconnecting. The returned
 * subscription's `close()` stops the stream and any further reconnection.
 */
export function subscribeRunEvents(
  config: DaemonClientConfig,
  runId: string,
  handlers: RunEventsHandlers,
): RunEventsSubscription {
  const query = handlers.afterSeq === undefined ? "" : `?afterSeq=${handlers.afterSeq}`;
  const source = openEventSource(config, `/api/runs/${encodeURIComponent(runId)}/events${query}`);

  const deliver = <T>(
    event: Event,
    schema: { parse(raw: unknown): T },
    handle: (value: T) => void,
  ) => deliverFrame(event, schema, handle, handlers.onParseError);

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
