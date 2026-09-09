import {
  isStepGuardBlocking,
  stepGuard,
  type EventEnvelope,
  type SupervisionDecision,
  type SupervisionEntry,
} from "@otomat/domain";

interface StepGuardReading {
  reason: string;
  blocking: boolean;
}

const DECISION_COPY = {
  pass: "Supervisor passed it",
  needs_changes: "Supervisor asked for changes",
  blocked: "Supervisor blocked the run",
} satisfies Record<SupervisionDecision["decision"], string>;

function supervisionReason(entry: SupervisionEntry): string {
  if (entry.state === "pending") {
    return "Delivered — waiting for this run's supervisor to judge it.";
  }
  if (entry.state === "unavailable") return `Supervision stopped: ${entry.reason}`;
  return `${DECISION_COPY[entry.decision.decision]}: ${entry.decision.reason}`;
}

export function stepGuardReading(
  events: readonly EventEnvelope[],
  stepRunId: string,
): StepGuardReading | null {
  const guard = stepGuard(events, stepRunId);
  if (guard === null) return null;
  const blocking = isStepGuardBlocking(guard);
  if (guard.kind === "delivery_blocked") return { reason: guard.reason, blocking };
  if (guard.kind === "override") {
    return { reason: "You accepted this step despite the guard.", blocking };
  }
  return { reason: supervisionReason(guard.entry), blocking };
}
