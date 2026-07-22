import { eq } from "drizzle-orm";

import type { Db } from "#db/client";

import { linearIssueDrafts } from "../schema.js";
import { touch } from "../touch.js";

export type NewLinearDraft = typeof linearIssueDrafts.$inferInsert;
export type LinearDraftRow = typeof linearIssueDrafts.$inferSelect;
export type LinearDraftPatch = Pick<
  NewLinearDraft,
  "base_updated_at" | "title" | "description" | "priority" | "assignee_id" | "label_ids"
>;

export function getLinearDraft(db: Db, issueId: string): LinearDraftRow | undefined {
  return db.select().from(linearIssueDrafts).where(eq(linearIssueDrafts.issue_id, issueId)).get();
}

export function upsertLinearDraft(db: Db, value: NewLinearDraft): void {
  db.insert(linearIssueDrafts)
    .values(value)
    .onConflictDoUpdate({
      target: linearIssueDrafts.issue_id,
      set: touch({
        base_updated_at: value.base_updated_at,
        title: value.title,
        description: value.description ?? null,
        priority: value.priority ?? 0,
        assignee_id: value.assignee_id ?? null,
        label_ids: value.label_ids,
      } satisfies LinearDraftPatch),
    })
    .run();
}

export function deleteLinearDraft(db: Db, issueId: string): void {
  db.delete(linearIssueDrafts).where(eq(linearIssueDrafts.issue_id, issueId)).run();
}
