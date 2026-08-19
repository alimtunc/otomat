import {
  isRunSettled,
  providerLimitSchema,
  type EventEnvelope,
  type ProviderLimit,
  type RunSettledState,
} from "@otomat/domain";

import { asString } from "#runtime";

import { SUPERVISOR_ADAPTER } from "./types.js";

function isSupervisorFinal(event: EventEnvelope): boolean {
  return (
    event.type === "run.lifecycle" &&
    event.payload["adapter"] === SUPERVISOR_ADAPTER &&
    event.payload["phase"] === "final"
  );
}

/** The slice of a run's ledger belonging to one agent session — a multi-step run holds one turn's evidence per session. */
export function eventsForSession(
  events: readonly EventEnvelope[],
  agentSessionId: string,
): EventEnvelope[] {
  return events.filter((event) => event.agent_session_id === agentSessionId);
}

interface FinalMarker {
  status: RunSettledState;
  payload: EventEnvelope["payload"];
}

/** The last terminal marker that actually stated an outcome; one that did not is no more the run's last word than a missing one. */
function lastFinalMarker(events: readonly EventEnvelope[]): FinalMarker | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (!event || !isSupervisorFinal(event)) continue;
    const status = asString(event.payload["final_status"]);
    if (status !== null && isRunSettled(status)) return { status, payload: event.payload };
  }
  return null;
}

/** Final-status of the last terminal marker in the ledger, or null if the run never wrote one. */
export function findFinalStatus(events: readonly EventEnvelope[]): RunSettledState | null {
  return lastFinalMarker(events)?.status ?? null;
}

/**
 * The quota the last turn ended on, read from that same terminal marker. Scoped
 * to the marker on purpose: one agent session spans several turns, and an earlier
 * turn's limit must never explain a later turn's failure.
 */
export function findProviderLimit(events: readonly EventEnvelope[]): ProviderLimit | null {
  const parsed = providerLimitSchema.safeParse(lastFinalMarker(events)?.payload["provider_limit"]);
  return parsed.success ? parsed.data : null;
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
