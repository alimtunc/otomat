import {
  listClaimedRunContributions,
  markRunContributionsDelivered,
  releaseRunContributionClaims,
  type Db,
} from "@otomat/db";

import { sessionDir } from "#events";

import { workerConsumedStartGate } from "../start-gate.js";
import { assertContributionTransitions } from "../transitions.js";

/** Only a start gate the worker consumed proves the batch reached a provider; a session row's `pid` survives every turn and can prove nothing. */
export function reconcileContributionClaims(db: Db, dataDir: string, now: string): void {
  for (const row of listClaimedRunContributions(db)) {
    const sessionId = row.agent_session_id;
    if (sessionId === null) continue;
    if (!workerConsumedStartGate(sessionDir(dataDir, row.run_id, sessionId))) {
      releaseRunContributionClaims(db, [row.id]);
      continue;
    }
    assertContributionTransitions([row], "delivered");
    markRunContributionsDelivered(db, [row.id], now);
  }
}
