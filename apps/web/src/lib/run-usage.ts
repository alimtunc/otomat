import type { EventEnvelope } from "@otomat/domain";
import { asNumber, asString } from "@web/lib/coerce";

/** Usage exactly as the runtime last reported it; a null field means the provider did not report it. */
export interface ReportedUsage {
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
}

/** Parse a `runtime.usage` payload into ReportedUsage; null when its `usage` object is absent or malformed. */
export function parseReportedUsage(payload: EventEnvelope["payload"]): ReportedUsage | null {
  const usage = payload["usage"];
  if (typeof usage !== "object" || usage === null) return null;
  const record = usage as Record<string, unknown>;
  return {
    model: asString(record["model"]),
    inputTokens: asNumber(record["input_tokens"]),
    outputTokens: asNumber(record["output_tokens"]),
    costUsd: asNumber(record["cost_usd"]),
  };
}

/** The last `runtime.usage` event, or undefined when the ledger carries none. */
export function latestUsageEvent(events: readonly EventEnvelope[]): EventEnvelope | undefined {
  return events.filter((event) => event.type === "runtime.usage").at(-1);
}

/**
 * The last `runtime.usage` event's payload, field by field — never summed or
 * estimated across turns. Null when the run's ledger carries no usage event.
 */
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
