import { listRunContributionsForSession, markRunContributionsSettled, type Db } from "@otomat/db";

import type { ReconcileClassification } from "../types.js";

/**
 * Resolves the messages one settled turn carried. An interrupted turn keeps them
 * `sent`: the agent did receive them and the turn can still be resumed.
 */
export function resolveSessionContributions(
  db: Db,
  agentSessionId: string,
  classification: ReconcileClassification,
  now: string,
): void {
  if (classification === "interrupted") return;
  const delivered = listRunContributionsForSession(db, agentSessionId).filter(
    (row) => row.status === "sent",
  );
  if (delivered.length === 0) return;
  const ids = delivered.map((row) => row.id);
  if (classification === "completed") {
    markRunContributionsSettled(db, ids, "completed", now);
    return;
  }
  markRunContributionsSettled(
    db,
    ids,
    "failed",
    now,
    `the turn carrying this message ended ${classification}`,
  );
}
