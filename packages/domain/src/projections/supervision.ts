import { z } from "zod";

import type { AgentSessionKind } from "../contracts/entities/runs.js";
import { supervisionDecisionSchema, type SupervisionDecision } from "../contracts/supervision.js";
import type { EventEnvelope } from "../events/envelope.js";

interface SupervisionPending {
  state: "pending";
}

interface SupervisionDecided {
  state: "decided";
  round: number;
  decision: SupervisionDecision;
}

interface SupervisionUnavailable {
  state: "unavailable";
  reason: string;
}

export type SupervisionEntry = SupervisionPending | SupervisionDecided | SupervisionUnavailable;

const supervisionEntrySchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("pending") }),
  z.object({
    state: z.literal("decided"),
    round: z.number().int().positive(),
    decision: supervisionDecisionSchema,
  }),
  z.object({ state: z.literal("unavailable"), reason: z.string().min(1) }),
]);

const deliveryBlockedSchema = z.object({ reason: z.string().min(1) });

interface DeliveryBlockedGuard {
  kind: "delivery_blocked";
  reason: string;
}

interface SupervisionGuard {
  kind: "supervision";
  entry: SupervisionEntry;
}

interface GuardOverride {
  kind: "override";
}

export type StepGuard = DeliveryBlockedGuard | SupervisionGuard | GuardOverride;

/** The run's supervisor turns, named apart from the step turns they judge but share a `step_run_id` with. */
export function supervisionSessionIds(
  sessions: readonly { id: string; kind: AgentSessionKind }[],
): ReadonlySet<string> {
  return new Set(
    sessions.filter((session) => session.kind === "supervision").map((session) => session.id),
  );
}

function supervisionEntryOf(event: EventEnvelope): SupervisionEntry | null {
  if (event.type !== "run.supervision_decision") return null;
  const parsed = supervisionEntrySchema.safeParse(event.payload);
  return parsed.success ? parsed.data : null;
}

/** Where supervision stands for each step, as its own journal left it — the last word wins. */
export function supervisionEntries(
  events: readonly EventEnvelope[],
): ReadonlyMap<string, SupervisionEntry> {
  const byStep = new Map<string, SupervisionEntry>();
  for (const event of events) {
    const entry = event.step_run_id === null ? null : supervisionEntryOf(event);
    if (entry !== null && event.step_run_id !== null) byStep.set(event.step_run_id, entry);
  }
  return byStep;
}

/** Every decision this step already received, in order; its length is the round a loop limit counts. */
export function supervisionDecisionsFor(
  events: readonly EventEnvelope[],
  stepRunId: string,
): SupervisionDecision[] {
  return events.flatMap((event) => {
    if (event.step_run_id !== stepRunId) return [];
    const entry = supervisionEntryOf(event);
    return entry?.state === "decided" ? [entry.decision] : [];
  });
}

/** The last thing the run's journal said about this step's guard, so a reader is told what the scheduler acted on. */
export function stepGuard(events: readonly EventEnvelope[], stepRunId: string): StepGuard | null {
  let guard: StepGuard | null = null;
  for (const event of events) {
    if (event.step_run_id !== stepRunId) continue;
    if (event.type === "run.delivery_blocked") {
      const parsed = deliveryBlockedSchema.safeParse(event.payload);
      if (parsed.success) guard = { kind: "delivery_blocked", reason: parsed.data.reason };
    }
    const entry = supervisionEntryOf(event);
    if (entry !== null) guard = { kind: "supervision", entry };
    if (event.type === "run.guard_override") guard = { kind: "override" };
  }
  return guard;
}

/** Whether the guard still holds the step: the one rule the daemon's override refusal and the cockpit's note share. */
export function isStepGuardBlocking(guard: StepGuard): boolean {
  if (guard.kind === "override") return false;
  if (guard.kind === "delivery_blocked") return true;
  return guard.entry.state !== "decided" || guard.entry.decision.decision !== "pass";
}
