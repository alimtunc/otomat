import type { Db } from "@otomat/db";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";

import { readConversations } from "./conversations.js";

const TICK_MS = 1_000;
const HEARTBEAT_EVERY_TICKS = 10;

/** State, not a ledger: a reconnect re-reads the snapshot, and a frame is written only when the projection changed. */
export function streamConversations(c: Context, db: Db) {
  return streamSSE(
    c,
    async (stream) => {
      let sent: string | null = null;
      let quietTicks = 0;
      while (!stream.aborted) {
        const snapshot = readConversations(db);
        const entries = JSON.stringify(snapshot.entries);
        if (entries === sent) {
          quietTicks += 1;
          if (quietTicks % HEARTBEAT_EVERY_TICKS === 0) {
            await stream.writeSSE({ event: "heartbeat", data: "" });
          }
        } else {
          sent = entries;
          quietTicks = 0;
          await stream.writeSSE({ event: "snapshot", data: JSON.stringify(snapshot) });
        }
        await stream.sleep(TICK_MS);
      }
    },
    async (error) => {
      console.error("[otomat] conversations stream failed", error);
    },
  );
}
