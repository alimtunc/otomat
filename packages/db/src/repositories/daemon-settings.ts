import { DEFAULT_MAX_CONCURRENT_SESSIONS } from "@otomat/domain";
import { eq } from "drizzle-orm";

import type { Db } from "../client.js";
import { daemonSettings } from "../schema/index.js";
import { touch } from "./touch.js";

/** A daemon holds exactly one settings row; the id is fixed so the upsert has a stable target. */
const DAEMON_SETTINGS_ID = "daemon";

/** The host's session cap. A daemon that was never configured answers the shipped default. */
export function readMaxConcurrentSessions(db: Db): number {
  const row = db
    .select()
    .from(daemonSettings)
    .where(eq(daemonSettings.id, DAEMON_SETTINGS_ID))
    .get();
  return row?.max_concurrent_sessions ?? DEFAULT_MAX_CONCURRENT_SESSIONS;
}

export function writeMaxConcurrentSessions(db: Db, maxConcurrentSessions: number): void {
  if (!Number.isInteger(maxConcurrentSessions) || maxConcurrentSessions < 1) {
    throw new RangeError(
      `max_concurrent_sessions must be a positive integer, got ${maxConcurrentSessions}`,
    );
  }
  db.insert(daemonSettings)
    .values({ id: DAEMON_SETTINGS_ID, max_concurrent_sessions: maxConcurrentSessions })
    .onConflictDoUpdate({
      target: daemonSettings.id,
      set: touch({ max_concurrent_sessions: maxConcurrentSessions }),
    })
    .run();
}
