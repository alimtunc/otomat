import type { Db } from "@otomat/db";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";

import { readActivity } from "./activity.js";

const TICK_MS = 1_000;
const HEARTBEAT_EVERY_TICKS = 10;

/** No cursor: this is state, not a ledger, so a reconnect re-reads the current snapshot instead of replaying what it missed. */
export function streamActivity(c: Context, db: Db) {
  return streamSSE(
    c,
    async (stream) => {
      let sent: string | null = null;
      let quietTicks = 0;
      while (!stream.aborted) {
        const snapshot = readActivity(db);
        const activities = JSON.stringify(snapshot.activities);
        if (activities === sent) {
          quietTicks += 1;
          if (quietTicks % HEARTBEAT_EVERY_TICKS === 0) {
            await stream.writeSSE({ event: "heartbeat", data: "" });
          }
        } else {
          sent = activities;
          quietTicks = 0;
          await stream.writeSSE({ event: "snapshot", data: JSON.stringify(snapshot) });
        }
        await stream.sleep(TICK_MS);
      }
    },
    // The stream carries no state a client could not rebuild, so a failure ends it and the reconnect re-reads the snapshot.
    async (error) => {
      console.error("[otomat] activity stream failed", error);
    },
  );
}
