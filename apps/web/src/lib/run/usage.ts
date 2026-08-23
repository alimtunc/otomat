import type { EventEnvelope } from "@otomat/domain";
import { asNumber, asString } from "@web/lib/coerce";

/** Usage exactly as the runtime last reported it; a null field means the provider did not report it. */
export interface ReportedUsage {
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
}

export function parseReportedUsage(payload: EventEnvelope["payload"]): ReportedUsage | null {
  const usage = payload["usage"];
  if (typeof usage !== "object" || usage === null) return null;
  // SAFETY: a non-null object indexes as a record; every read is type-checked after.
  const record = usage as Record<string, unknown>;
  return {
    model: asString(record["model"]),
    inputTokens: asNumber(record["input_tokens"]),
    outputTokens: asNumber(record["output_tokens"]),
    costUsd: asNumber(record["cost_usd"]),
  };
}

export function latestUsageEvent(events: readonly EventEnvelope[]): EventEnvelope | undefined {
  return events.filter((event) => event.type === "runtime.usage").at(-1);
}

/** Never summed or estimated across turns: the last `runtime.usage` payload field by field, null when the ledger carries none. */
export function latestReportedUsage(events: EventEnvelope[]): ReportedUsage | null {
  const payload = latestUsageEvent(events)?.payload;
  return payload ? parseReportedUsage(payload) : null;
}

export function formatTokenCount(count: number): string {
  if (count < 1000) return String(count);
  const thousands = count / 1000;
  return `${thousands >= 100 ? Math.round(thousands) : thousands.toFixed(1)}k`;
}

export function formatCostUsd(cost: number): string {
  return `$${cost.toFixed(3)}`;
}
