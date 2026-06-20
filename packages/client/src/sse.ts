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

  source.addEventListener("event", (event) => {
    handlers.onEvent(eventEnvelopeSchema.parse(JSON.parse((event as MessageEvent).data)));
  });
  source.addEventListener("end", (event) => {
    handlers.onEnd?.(runEndPayloadSchema.parse(JSON.parse((event as MessageEvent).data)));
    source.close();
  });
  source.addEventListener("stream_error", (event) => {
    handlers.onStreamError?.(
      runStreamErrorPayloadSchema.parse(JSON.parse((event as MessageEvent).data)),
    );
    source.close();
  });
  source.addEventListener("open", () => handlers.onOpen?.());
  source.addEventListener("error", (event) => handlers.onError?.(event));

  return { close: () => source.close() };
}
