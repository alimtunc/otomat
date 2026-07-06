import { isRunTerminal, type EventEnvelope, type RunTerminalState } from "@otomat/domain";

import { asString } from "#runtime/cli/frame-guards";

import { SUPERVISOR_ADAPTER } from "./types.js";

function isSupervisorFinal(event: EventEnvelope): boolean {
  return (
    event.type === "run.lifecycle" &&
    event.payload["adapter"] === SUPERVISOR_ADAPTER &&
    event.payload["phase"] === "final"
  );
}

/** Final-status of the last terminal marker in the ledger, or null if the run never wrote one. */
export function findFinalStatus(events: readonly EventEnvelope[]): RunTerminalState | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event && isSupervisorFinal(event)) {
      const status = asString(event.payload["final_status"]);
      if (status !== null && isRunTerminal(status)) return status;
    }
  }
  return null;
}

/** Provider session id (the resume key) — from the terminal marker first, else a runtime `provider_session` frame. */
export function findProviderSessionId(events: readonly EventEnvelope[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (!event) continue;
    if (isSupervisorFinal(event)) {
      const fromMarker = asString(event.payload["provider_session_id"]);
      if (fromMarker !== null) return fromMarker;
    }
    if (event.type === "runtime.provider_session") {
      const fromFrame = asString(event.payload["provider_session_id"]);
      if (fromFrame !== null) return fromFrame;
    }
  }
  return null;
}
