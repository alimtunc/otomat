import type { EventEnvelope } from "@otomat/domain";

/** Usage exactly as the runtime last reported it; a null field means the provider did not report it. */
export interface ReportedUsage {
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * The last `runtime.usage` event's payload, field by field — never summed or
 * estimated across turns. Null when the run's ledger carries no usage event.
 */
export function latestReportedUsage(events: EventEnvelope[]): ReportedUsage | null {
  const usageEvents = events.filter((event) => event.type === "runtime.usage");
  const payload = usageEvents.at(-1)?.payload;
  if (!payload) return null;
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

export function formatTokenCount(count: number): string {
  if (count < 1000) return String(count);
  const thousands = count / 1000;
  return `${thousands >= 100 ? Math.round(thousands) : thousands.toFixed(1)}k`;
}

export function formatCostUsd(cost: number): string {
  return `$${cost.toFixed(3)}`;
}
