import { getPullRequestForRun, getRun, type Db } from "@otomat/db";
import {
  isPullRequestPublicationActive,
  isRunSettled,
  type RunEndPayload,
  type RunStreamErrorPayload,
} from "@otomat/domain";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";

import { readRunEvents } from "#events";

import { nonNegativeInt } from "./query-params.js";

const POLL_INTERVAL_MS = 500;
/** ~10s of silence between heartbeats keeps proxies and EventSource alive without spamming. */
const HEARTBEAT_EVERY_TICKS = 20;

/** The `?afterSeq` anchor stays in the URL across reconnects, so the larger of it and `Last-Event-ID` wins. */
function parseCursor(
  query: string | undefined,
  lastEventId: string | undefined,
): number | undefined {
  const anchor = nonNegativeInt(query);
  const delivered = nonNegativeInt(lastEventId);
  if (anchor === undefined) return delivered;
  return delivered === undefined ? anchor : Math.max(anchor, delivered);
}

/** A publication outlives the run that produced it, so a settled run still streams while one is in flight. */
function isPublishing(db: Db, runId: string): boolean {
  const pullRequest = getPullRequestForRun(db, runId);
  return (
    pullRequest !== undefined && isPullRequestPublicationActive(pullRequest.publication_status)
  );
}

/** Each event carries its `seq` as the SSE id so an EventSource reconnect resumes via `Last-Event-ID`. */
export function streamRunEvents(c: Context, db: Db, runId: string) {
  const afterSeq = parseCursor(c.req.query("afterSeq"), c.req.header("Last-Event-ID"));
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
        if (!run || (isRunSettled(run.status) && events.length === 0 && !isPublishing(db, runId))) {
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
