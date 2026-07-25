import { listRunContributionsForSession, markRunContributionsSettled, type Db } from "@otomat/db";

import { assertContributionTransitions } from "../transitions.js";
import type { ReconcileClassification } from "../types.js";

/** An interrupted turn keeps its messages `sent`: the agent did receive them and the turn can still be resumed. */
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
    assertContributionTransitions(delivered, "completed");
    markRunContributionsSettled(db, ids, "completed", now);
    return;
  }
  assertContributionTransitions(delivered, "failed");
  markRunContributionsSettled(
    db,
    ids,
    "failed",
    now,
    `the turn carrying this message ended ${classification}`,
  );
}
