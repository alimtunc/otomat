import {
  eventEnvelopeSchema,
  runEndPayloadSchema,
  runStreamErrorPayloadSchema,
} from "@otomat/domain";

import { resolveUrl } from "./http";
import type { DaemonClientConfig, RunEventsHandlers, RunEventsSubscription } from "./types";

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
