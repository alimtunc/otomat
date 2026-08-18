import type { ReportedUsageContract, ScopeUsage } from "@otomat/domain";

export function toReportedUsage(usage: ScopeUsage): ReportedUsageContract {
  return {
    availability: usage.availability,
    input_tokens: usage.input,
    output_tokens: usage.output,
    cost_usd: usage.costUsd,
    turns: usage.turns,
  };
}
