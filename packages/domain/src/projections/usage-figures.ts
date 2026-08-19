import type { UsageFigures, UsageMetric } from "../contracts/usage.js";
import type { UsageTurnEvidence } from "./evidence.js";

export type UsageMetricState = "reported" | "partial" | "unavailable";

const EMPTY_METRIC: UsageMetric = { value: null, reported_turns: 0 };

export const EMPTY_FIGURES: UsageFigures = {
  turns: 0,
  unreadable_turns: 0,
  input_tokens: EMPTY_METRIC,
  output_tokens: EMPTY_METRIC,
  cost_usd: EMPTY_METRIC,
};

/** Null plus null stays null: a metric nobody reported is never promoted to a zero. */
function addMetric(total: UsageMetric, value: number | null, turns: number): UsageMetric {
  return {
    value: value === null ? total.value : (total.value ?? 0) + value,
    reported_turns: total.reported_turns + turns,
  };
}

export function addTurns(total: UsageFigures, row: UsageTurnEvidence): UsageFigures {
  return {
    turns: total.turns + row.turns,
    unreadable_turns: total.unreadable_turns + row.unreadable_turns,
    input_tokens: addMetric(total.input_tokens, row.input_tokens, row.input_turns),
    output_tokens: addMetric(total.output_tokens, row.output_tokens, row.output_turns),
    cost_usd: addMetric(total.cost_usd, row.cost_usd, row.cost_turns),
  };
}

export function usageMetricState(metric: UsageMetric, turns: number): UsageMetricState {
  if (metric.reported_turns === 0) return "unavailable";
  return metric.reported_turns < turns ? "partial" : "reported";
}

/** Input and output as one comparable size for ranking; its coverage is the turns that reported either side. */
export function usageTokenMetric(figures: UsageFigures): UsageMetric {
  const input = figures.input_tokens.value;
  const output = figures.output_tokens.value;
  return {
    value: input === null && output === null ? null : (input ?? 0) + (output ?? 0),
    reported_turns: Math.max(
      figures.input_tokens.reported_turns,
      figures.output_tokens.reported_turns,
    ),
  };
}
