import { and, eq } from "drizzle-orm";

import type { Db } from "../client.js";
import { linearWrites } from "../schema/index.js";
import { touch } from "./touch.js";

export type NewLinearWrite = typeof linearWrites.$inferInsert;
export type LinearWriteRow = typeof linearWrites.$inferSelect;
export type LinearWritePatch = Partial<
  Pick<
    LinearWriteRow,
    "status" | "payload_json" | "detail" | "remote_id" | "error_code" | "error_message" | "run_id"
  >
>;

export function insertLinearWrite(db: Db, value: NewLinearWrite): void {
  db.insert(linearWrites).values(value).run();
}

export function getLinearWrite(db: Db, id: string): LinearWriteRow | undefined {
  return db.select().from(linearWrites).where(eq(linearWrites.id, id)).get();
}

export function getLinearWriteByIdentity(
  db: Db,
  issueId: string,
  kind: LinearWriteRow["kind"],
  idempotencyKey: string,
): LinearWriteRow | undefined {
  return db
    .select()
    .from(linearWrites)
    .where(
      and(
        eq(linearWrites.issue_id, issueId),
        eq(linearWrites.kind, kind),
        eq(linearWrites.idempotency_key, idempotencyKey),
      ),
    )
    .get();
}

export function listLinearWritesForIssue(db: Db, issueId: string): LinearWriteRow[] {
  return db
    .select()
    .from(linearWrites)
    .where(eq(linearWrites.issue_id, issueId))
    .orderBy(linearWrites.created_at, linearWrites.id)
    .all();
}

export function updateLinearWrite(db: Db, id: string, patch: LinearWritePatch): void {
  db.update(linearWrites).set(touch(patch)).where(eq(linearWrites.id, id)).run();
}
