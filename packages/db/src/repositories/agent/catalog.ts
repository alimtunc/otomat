import { eq } from "drizzle-orm";

import type { Db } from "#db/client";

import { agents } from "../schema.js";
import { touch } from "../touch.js";

export type NewAgent = typeof agents.$inferInsert;
export type AgentRow = typeof agents.$inferSelect;

/** Idempotent writer for the builtin agent catalog: insert, or refresh name/runtime in place. */
export function upsertAgent(db: Db, value: NewAgent): void {
  db.insert(agents)
    .values(value)
    .onConflictDoUpdate({
      target: agents.id,
      set: touch({ name: value.name, runtime: value.runtime }),
    })
    .run();
}

export function getAgent(db: Db, id: string): AgentRow | undefined {
  return db.select().from(agents).where(eq(agents.id, id)).get();
}
