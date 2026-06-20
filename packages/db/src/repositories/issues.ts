import { eq } from "drizzle-orm";

import type { Db } from "../client.js";
import { issues } from "../schema/index.js";

export type NewIssue = typeof issues.$inferInsert;
export type IssueRow = typeof issues.$inferSelect;

export function insertIssue(db: Db, value: NewIssue): void {
  db.insert(issues).values(value).run();
}

export function getIssue(db: Db, id: string): IssueRow | undefined {
  return db.select().from(issues).where(eq(issues.id, id)).get();
}
