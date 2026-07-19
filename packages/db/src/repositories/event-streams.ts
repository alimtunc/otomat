import { eq } from "drizzle-orm";

import type { Db } from "../client.js";
import { eventStreams } from "../schema/index.js";

export type NewEventStream = typeof eventStreams.$inferInsert;
export type EventStreamRow = typeof eventStreams.$inferSelect;

export class EventStreamConflictError extends Error {
  constructor(streamId: string, message: string) {
    super(`event stream ${streamId}: ${message}`);
    this.name = "EventStreamConflictError";
  }
}

export function getEventStream(db: Db, id: string): EventStreamRow | undefined {
  return db.select().from(eventStreams).where(eq(eventStreams.id, id)).get();
}

export function ensureEventStream(db: Db, value: NewEventStream): EventStreamRow {
  db.insert(eventStreams).values(value).onConflictDoNothing().run();
  const stream = getEventStream(db, value.id);
  if (!stream) throw new Error(`event stream ${value.id} vanished after insert`);
  if (stream.run_id !== value.run_id || stream.file_path !== value.file_path) {
    throw new EventStreamConflictError(value.id, "already attached to another run or file");
  }
  return stream;
}
