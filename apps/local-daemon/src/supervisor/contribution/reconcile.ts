import {
  listClaimedRunContributions,
  markRunContributionsDelivered,
  releaseRunContributionClaims,
  type Db,
} from "@otomat/db";

import { sessionDir } from "#events";

import { liveInputIds, liveInputReceipts } from "../live-input.js";
import { workerConsumedStartGate } from "../start-gate.js";
import { assertContributionTransitions } from "../transitions.js";

/**
 * A claim the daemon did not live to resolve: a live message is proven by its own
 * receipt, a spawned batch by the consumed start gate (a session row's `pid`
 * survives every turn and proves nothing). Anything unproven rejoins the queue.
 */
export function reconcileContributionClaims(db: Db, dataDir: string, now: string): void {
  for (const row of listClaimedRunContributions(db)) {
    const sessionId = row.agent_session_id;
    if (sessionId === null) continue;
    const dir = sessionDir(dataDir, row.run_id, sessionId);
    const wasLive = liveInputIds(dir).has(row.id);
    const proven = wasLive
      ? liveInputReceipts(dir).get(row.id) === null
      : workerConsumedStartGate(dir);
    if (!proven) {
      releaseRunContributionClaims(db, [row.id]);
      continue;
    }
    assertContributionTransitions([row], "delivered");
    markRunContributionsDelivered(db, [row.id], now);
  }
}
