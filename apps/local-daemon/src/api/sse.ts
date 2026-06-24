import { getRun, type Db } from "@otomat/db";
import { isRunTerminal, type RunEndPayload, type RunStreamErrorPayload } from "@otomat/domain";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";

import { readRunEvents } from "#events";

const POLL_INTERVAL_MS = 500;
/** ~10s of silence between heartbeats keeps proxies and EventSource alive without spamming. */
const HEARTBEAT_EVERY_TICKS = 20;

/** Each event carries its `seq` as the SSE id so an EventSource reconnect resumes via `Last-Event-ID`. */
export function streamRunEvents(c: Context, db: Db, runId: string, afterSeq: number | undefined) {
  return streamSSE(c, async (stream) => {
    let cursor = afterSeq;
    let ticks = 0;

    try {
      while (!stream.aborted) {
        const events = readRunEvents(db, runId, cursor === undefined ? {} : { afterSeq: cursor });
        for (const event of events) {
          await stream.writeSSE({
            id: String(event.seq),
            event: "event",
            data: JSON.stringify(event),
          });
          cursor = event.seq;
        }

        const run = getRun(db, runId);
        if (!run || (isRunTerminal(run.status) && events.length === 0)) {
          const status = run?.status ?? "canceled";
          await stream.writeSSE({
            event: "end",
            data: JSON.stringify({ status } satisfies RunEndPayload),
          });
          return;
        }

        ticks += 1;
        if (ticks % HEARTBEAT_EVERY_TICKS === 0) {
          await stream.writeSSE({ event: "heartbeat", data: "" });
        }
        await stream.sleep(POLL_INTERVAL_MS);
      }
    } catch (error) {
      console.error(`[otomat] run ${runId} event stream failed`, error);
      // Stream may already be half-closed, so a failed terminal write is expected and ignorable.
      await stream
        .writeSSE({
          event: "stream_error",
          data: JSON.stringify({ message: "event stream failed" } satisfies RunStreamErrorPayload),
        })
        .catch(() => {});
    }
  });
}
