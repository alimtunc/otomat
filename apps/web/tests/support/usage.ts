import type { ReportedUsageContract, RunUsageResponse } from "@otomat/domain";

export function reportedUsage(
  overrides: Partial<ReportedUsageContract> = {},
): ReportedUsageContract {
  return {
    availability: "final",
    input_tokens: 1200,
    output_tokens: 340,
    cost_usd: 0.021,
    turns: 1,
    ...overrides,
  };
}

export function runUsageResponse(overrides: Partial<RunUsageResponse> = {}): RunUsageResponse {
  return {
    run_id: "run-1",
    total: reportedUsage(),
    steps: [],
    ...overrides,
  };
}
