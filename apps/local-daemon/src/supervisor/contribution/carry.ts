import {
  claimRunContributions,
  failRunContributionDelivery,
  listClaimableStepContributions,
  listRunContributionsForSession,
  markRunContributionsDelivered,
  releaseRunContributionClaims,
  type RunContributionRow,
} from "@otomat/db";

import type { SupervisorState } from "../state.js";
import { assertContributionTransitions } from "../transitions.js";
import { emitContributionEvents } from "./events.js";

export type CarryOutcome =
  | { kind: "delivered" }
  | { kind: "released" }
  | { kind: "failed"; reason: string };

/** Already-claimed rows are skipped, so a delivery that claimed its own batch first does not claim it twice. */
export function claimStepContributions(
  state: SupervisorState,
  stepRunId: string,
  agentSessionId: string,
): void {
  const queued = listClaimableStepContributions(state.db, stepRunId);
  if (queued.length === 0) return;
  claimRunContributions(
    state.db,
    queued.map((row) => row.id),
    agentSessionId,
  );
}

/** The batch this session is carrying right now: claimed by it and not yet resolved by a spawn. */
export function carriedContributions(
  state: SupervisorState,
  agentSessionId: string,
): RunContributionRow[] {
  return listRunContributionsForSession(state.db, agentSessionId).filter(
    (row) => row.status === "queued",
  );
}

/** The only path to `delivered`: a launched turn is the evidence the message reached the provider. */
export function resolveCarriedContributions(
  state: SupervisorState,
  agentSessionId: string,
  outcome: CarryOutcome,
): void {
  const carried = carriedContributions(state, agentSessionId);
  if (carried.length === 0) return;
  const ids = carried.map((row) => row.id);
  if (outcome.kind === "released") {
    releaseRunContributionClaims(state.db, ids);
    return;
  }
  if (outcome.kind === "failed") {
    assertContributionTransitions(carried, "failed");
    failRunContributionDelivery(state.db, ids, outcome.reason);
    emitContributionEvents(state, ids);
    return;
  }
  assertContributionTransitions(carried, "delivered");
  markRunContributionsDelivered(state.db, ids, new Date().toISOString());
  emitContributionEvents(state, ids);
}
