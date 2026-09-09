import type { SupervisionEntry } from "@otomat/domain";

import { buildRuntimeEvent, type RuntimeEvent } from "#runtime";

import type { SessionRef } from "../markers.js";
import { SUPERVISOR_ADAPTER } from "../types.js";

/** The whole entry is the payload, so the fold that reads it back is the same one the cockpit uses. */
export function buildSupervisionEvent(
  ref: SessionRef,
  entry: SupervisionEntry,
  occurredAt: string,
): RuntimeEvent {
  return buildRuntimeEvent({
    ...ref,
    kind: "supervision",
    type: "run.supervision_decision",
    source: "otomat",
    adapter: SUPERVISOR_ADAPTER,
    occurredAt,
    payload: { ...entry },
  });
}
