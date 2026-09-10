import type { EventEnvelope } from "../events/envelope.js";

/** `unavailable` is the honest absence — never rendered as a zero. */
export const USAGE_AVAILABILITIES = ["live", "final", "unavailable"] as const;
export type UsageAvailability = (typeof USAGE_AVAILABILITIES)[number];

/** A null field is one the provider never reported. */
export interface ReportedTokens {
  input: number | null;
  output: number | null;
  costUsd: number | null;
  turns: number;
}

export interface ScopeUsage extends ReportedTokens {
  availability: UsageAvailability;
}

const EMPTY: ReportedTokens = { input: null, output: null, costUsd: null, turns: 0 };

function readNumber(source: Record<string, unknown>, key: string): number | null {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function add(total: number | null, next: number | null): number | null {
  if (next === null) return total;
  return (total ?? 0) + next;
}

// One event is one turn's own totals, so summing them is a fact rather than an estimate.
function sumReportedUsage(events: readonly EventEnvelope[]): ReportedTokens {
  let total = EMPTY;
  for (const event of events) {
    if (event.type !== "runtime.usage") continue;
    const usage = event.payload["usage"];
    if (typeof usage !== "object" || usage === null) continue;
    // SAFETY: a non-null object indexes as a record; every read is number-checked after.
    const record = usage as Record<string, unknown>;
    total = {
      input: add(total.input, readNumber(record, "input_tokens")),
      output: add(total.output, readNumber(record, "output_tokens")),
      costUsd: add(total.costUsd, readNumber(record, "cost_usd")),
      turns: total.turns + 1,
    };
  }
  return total;
}

/** `settled` is what closes a scope: an unsettled scope with no usage yet is still `live`, not `unavailable`. */
export function scopeUsage(events: readonly EventEnvelope[], settled: boolean): ScopeUsage {
  const totals = sumReportedUsage(events);
  if (totals.turns === 0) return { ...totals, availability: settled ? "unavailable" : "live" };
  return { ...totals, availability: settled ? "final" : "live" };
}

/** The turns of a named set of sessions; a supervisor's cost is read apart from the steps it judged. */
export function sessionsUsage(
  events: readonly EventEnvelope[],
  agentSessionIds: ReadonlySet<string>,
  settled: boolean,
): ScopeUsage {
  return scopeUsage(
    events.filter(
      (event) => event.agent_session_id !== null && agentSessionIds.has(event.agent_session_id),
    ),
    settled,
  );
}

/** A supervision turn names the step it judges, so its own sessions are excluded from that step's cost. */
export function stepUsage(
  events: readonly EventEnvelope[],
  stepRunId: string,
  settled: boolean,
  excludedSessionIds: ReadonlySet<string>,
): ScopeUsage {
  return scopeUsage(
    events.filter(
      (event) =>
        event.step_run_id === stepRunId &&
        (event.agent_session_id === null || !excludedSessionIds.has(event.agent_session_id)),
    ),
    settled,
  );
}
