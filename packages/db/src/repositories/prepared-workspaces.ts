import { eq } from "drizzle-orm";

import type { Db } from "../client.js";
import { worktrees } from "../schema/workspace.js";
import { touch } from "./touch.js";

export function preparedWorkspace(db: Db, issueId: string) {
  return db.select().from(worktrees).where(eq(worktrees.prepared_issue_id, issueId)).get();
}

export function releasePreparedWorkspace(db: Db, issueId: string): void {
  db.update(worktrees)
    .set(touch({ prepared_issue_id: null }))
    .where(eq(worktrees.prepared_issue_id, issueId))
    .run();
}

export function adoptPreparedWorkspace(db: Db, issueId: string, runId: string): void {
  db.update(worktrees)
    .set(touch({ prepared_issue_id: null, owner_token: runId }))
    .where(eq(worktrees.prepared_issue_id, issueId))
    .run();
}
