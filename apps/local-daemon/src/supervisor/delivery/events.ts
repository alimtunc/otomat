import type { DeliveryEvidence, DeliveryExpectation } from "@otomat/domain";

import { buildRuntimeEvent, type RuntimeEvent } from "#runtime";

import type { SessionRef } from "../markers.js";
import { SUPERVISOR_ADAPTER } from "../types.js";

/** Journals the whole snapshot, not just its verdict, so why a step stopped stays auditable after the worktree moves on. */
export function buildDeliveryBlockedEvent(
  ref: SessionRef,
  expectation: DeliveryExpectation,
  reason: string,
  evidence: DeliveryEvidence,
  occurredAt: string,
): RuntimeEvent {
  return buildRuntimeEvent({
    ...ref,
    kind: "delivery_blocked",
    type: "run.delivery_blocked",
    source: "otomat",
    adapter: SUPERVISOR_ADAPTER,
    occurredAt,
    payload: { expectation, reason, evidence },
  });
}

/** Names the operator's own decision as the reason a dependent started, so the history never reads as a verified delivery. */
export function buildGuardOverrideEvent(
  ref: SessionRef,
  stepName: string,
  note: string,
  occurredAt: string,
): RuntimeEvent {
  return buildRuntimeEvent({
    ...ref,
    kind: "guard_override",
    type: "run.guard_override",
    source: "otomat",
    adapter: SUPERVISOR_ADAPTER,
    occurredAt,
    payload: { step_name: stepName, note },
  });
}
