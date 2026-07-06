import type { PullRequestState } from "@otomat/domain";
import { desc, eq } from "drizzle-orm";

import type { Db } from "../client.js";
import { pullRequests } from "../schema/index.js";
import { touch } from "./touch.js";

export type NewPullRequest = typeof pullRequests.$inferInsert;
export type PullRequestRow = typeof pullRequests.$inferSelect;

export function insertPullRequest(db: Db, value: NewPullRequest): void {
  db.insert(pullRequests).values(value).run();
}

export function getPullRequest(db: Db, id: string): PullRequestRow | undefined {
  return db.select().from(pullRequests).where(eq(pullRequests.id, id)).get();
}

/** A run has at most one local PR draft; the latest row wins if legacy data ever holds more. */
export function getPullRequestForRun(db: Db, runId: string): PullRequestRow | undefined {
  return db
    .select()
    .from(pullRequests)
    .where(eq(pullRequests.run_id, runId))
    .orderBy(desc(pullRequests.created_at))
    .get();
}

function patchPullRequest(
  db: Db,
  id: string,
  set: Partial<typeof pullRequests.$inferInsert>,
): void {
  db.update(pullRequests).set(touch(set)).where(eq(pullRequests.id, id)).run();
}

export function updatePullRequestDraft(
  db: Db,
  id: string,
  draft: { title: string; body: string | null },
): void {
  patchPullRequest(db, id, draft);
}

export function updatePullRequestStatus(db: Db, id: string, status: PullRequestState): void {
  patchPullRequest(db, id, { status });
}
