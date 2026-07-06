import { sql, type SQL } from "drizzle-orm";

/** Every update* stamps updated_at (see index.ts doc header); inserts rely on the schema default. */
export function touch<T extends object>(set: T): T & { updated_at: SQL } {
  return { ...set, updated_at: sql`(CURRENT_TIMESTAMP)` };
}
