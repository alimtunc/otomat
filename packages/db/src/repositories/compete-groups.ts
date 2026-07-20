import { competeGroupMachine, type CompeteGroupState } from "@otomat/domain";
import { eq } from "drizzle-orm";

import type { Db } from "../client.js";
import { competeGroups, stepRuns } from "../schema/index.js";
import { touch } from "./touch.js";

export type NewCompeteGroup = typeof competeGroups.$inferInsert;
export type CompeteGroupRow = typeof competeGroups.$inferSelect;

export class CompeteWinnerConflictError extends Error {
  constructor(groupId: string, message = "winner cannot be selected") {
    super(`compete group ${groupId}: ${message}`);
    this.name = "CompeteWinnerConflictError";
  }
}

export function insertCompeteGroup(db: Db, value: NewCompeteGroup): void {
  db.insert(competeGroups).values(value).run();
}

export function getCompeteGroup(db: Db, id: string): CompeteGroupRow | undefined {
  return db.select().from(competeGroups).where(eq(competeGroups.id, id)).get();
}

export function listCompeteGroupsForRun(db: Db, runId: string): CompeteGroupRow[] {
  return db
    .select()
    .from(competeGroups)
    .where(eq(competeGroups.run_id, runId))
    .orderBy(competeGroups.idx)
    .all();
}

export function updateCompeteGroupStatus(db: Db, id: string, status: CompeteGroupState): void {
  db.update(competeGroups).set(touch({ status })).where(eq(competeGroups.id, id)).run();
}

export function updateCompeteGroupBase(db: Db, id: string, baseHeadSha: string): void {
  db.update(competeGroups)
    .set(touch({ base_head_sha: baseHeadSha }))
    .where(eq(competeGroups.id, id))
    .run();
}

export function claimCompeteWinner(db: Db, groupId: string, stepRunId: string): CompeteGroupRow {
  return db.transaction(
    (tx) => {
      const group = tx.select().from(competeGroups).where(eq(competeGroups.id, groupId)).get();
      if (!group) throw new CompeteWinnerConflictError(groupId, "group not found");
      if (group.winner_step_run_id === stepRunId && group.status === "promoting") return group;
      if (group.status !== "awaiting_selection" || group.winner_step_run_id !== null) {
        throw new CompeteWinnerConflictError(groupId, "another winner is already reserved");
      }

      const candidate = tx.select().from(stepRuns).where(eq(stepRuns.id, stepRunId)).get();
      if (
        !candidate ||
        candidate.compete_group_id !== groupId ||
        candidate.status !== "succeeded"
      ) {
        throw new CompeteWinnerConflictError(groupId, "candidate is not a succeeded result");
      }

      const status = competeGroupMachine.transition(group.status, "promoting");
      tx.update(competeGroups)
        .set(touch({ status, winner_step_run_id: stepRunId }))
        .where(eq(competeGroups.id, groupId))
        .run();
      const claimed = tx.select().from(competeGroups).where(eq(competeGroups.id, groupId)).get();
      if (!claimed) throw new Error(`compete group ${groupId} vanished after winner claim`);
      return claimed;
    },
    { behavior: "immediate" },
  );
}
