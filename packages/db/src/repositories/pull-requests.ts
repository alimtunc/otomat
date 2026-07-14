import { eq } from "drizzle-orm";

import type { Db } from "../client.js";
import { pullRequests } from "../schema/index.js";
import { touch } from "./touch.js";

export type NewPullRequest = typeof pullRequests.$inferInsert;
export type PullRequestRow = typeof pullRequests.$inferSelect;
export type PullRequestPatch = Partial<
  Pick<
    PullRequestRow,
    | "provider"
    | "number"
    | "url"
    | "status"
    | "publication_status"
    | "title"
    | "body"
    | "head_ref"
    | "base_ref"
    | "published_head_sha"
    | "published_diff_sha"
    | "error_code"
    | "error_message"
  >
>;

export function insertPullRequest(db: Db, value: NewPullRequest): void {
  db.insert(pullRequests).values(value).run();
}

export function getPullRequestForRun(db: Db, runId: string): PullRequestRow | undefined {
  return db.select().from(pullRequests).where(eq(pullRequests.run_id, runId)).get();
}

export function updatePullRequest(db: Db, id: string, patch: PullRequestPatch): void {
  db.update(pullRequests).set(touch(patch)).where(eq(pullRequests.id, id)).run();
}
