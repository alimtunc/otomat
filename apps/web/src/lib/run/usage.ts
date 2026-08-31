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

const COMPACT_TOKENS = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumSignificantDigits: 3,
});
const EXACT_TOKENS = new Intl.NumberFormat("en-US");
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatTokenCount(count: number): string {
  return COMPACT_TOKENS.format(count).replace("K", "k");
}

/** Every compact count carries this in a `title` so the rounded figure stays inspectable. */
export function formatExactTokenCount(count: number): string {
  return EXACT_TOKENS.format(count);
}

export function formatCostUsd(cost: number): string {
  return USD.format(cost);
}
