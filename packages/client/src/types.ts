import type { EventEnvelope, RunEndPayload, RunStreamErrorPayload } from "@otomat/domain";

export interface DaemonClientConfig {
  /** Prefix for every request path. Empty (default) targets the same origin (Vite proxies `/api`). */
  baseUrl?: string;
  fetch?: typeof fetch;
  EventSource?: typeof EventSource;
}

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
