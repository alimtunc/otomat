import { asc, eq } from "drizzle-orm";

import type { Db } from "#db/client";

import { linearConnections } from "../schema.js";
import { touch } from "../touch.js";

export type LinearConnectionRow = typeof linearConnections.$inferSelect;
export type LinearConnectionIdentity = Pick<
  LinearConnectionRow,
  "workspace_id" | "workspace_name" | "user_name"
>;

export function listLinearConnections(db: Db): LinearConnectionRow[] {
  return db.select().from(linearConnections).orderBy(asc(linearConnections.created_at)).all();
}

export function getLinearConnection(db: Db, id: string): LinearConnectionRow | undefined {
  return db.select().from(linearConnections).where(eq(linearConnections.id, id)).get();
}

export function saveLinearConnection(
  db: Db,
  value: { id: string; label: string } & LinearConnectionIdentity,
): void {
  db.insert(linearConnections)
    .values(value)
    .onConflictDoUpdate({
      target: linearConnections.id,
      set: touch({
        label: value.label,
        workspace_id: value.workspace_id,
        workspace_name: value.workspace_name,
        user_name: value.user_name,
      }),
    })
    .run();
}

export function deleteLinearConnection(db: Db, id: string): void {
  db.delete(linearConnections).where(eq(linearConnections.id, id)).run();
}
