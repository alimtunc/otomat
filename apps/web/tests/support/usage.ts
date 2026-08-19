import type {
  ReportedUsageContract,
  RunUsageResponse,
  UsageDashboard,
  UsageFigures,
  UsageRunRow,
} from "@otomat/domain";

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

export function usageFigures(overrides: Partial<UsageFigures> = {}): UsageFigures {
  return {
    turns: 2,
    unreadable_turns: 0,
    input_tokens: { value: 1200, reported_turns: 2 },
    output_tokens: { value: 340, reported_turns: 2 },
    cost_usd: { value: 0.021, reported_turns: 2 },
    ...overrides,
  };
}

export function usageRunRow(overrides: Partial<UsageRunRow> = {}): UsageRunRow {
  return {
    run_id: "run-1234abcd",
    status: "completed",
    project_id: "p1",
    project_name: "First",
    issue_id: "i1",
    issue_identifier: "OTO-1",
    issue_title: "Build the usage dashboard",
    emitters: [{ runtime: "claude", model: "claude-opus-5" }],
    last_activity_at: "2026-08-10T10:00:00.000Z",
    duration_ms: 3_600_000,
    figures: usageFigures(),
    ...overrides,
  };
}

export function usageDashboardResponse(overrides: Partial<UsageDashboard> = {}): UsageDashboard {
  return {
    range: { from: "2026-07-11T00:00:00.000Z", to: "2026-08-10T12:00:00.000Z" },
    totals: {
      figures: usageFigures(),
      runs: 1,
      steps: 1,
      duration: {
        total_ms: 3_600_000,
        measured_runs: 1,
        unmeasured_runs: 0,
      },
    },
    daily: [{ day: "2026-08-10", figures: usageFigures(), runs: 1 }],
    projects: [{ project_id: "p1", project_name: "First", figures: usageFigures(), runs: 1 }],
    emitters: [
      {
        emitter: { runtime: "claude", model: "claude-opus-5" },
        figures: usageFigures(),
        runs: 1,
      },
    ],
    runs: [usageRunRow()],
    options: {
      projects: [{ id: "p1", name: "First" }],
      emitters: [{ runtime: "claude", model: "claude-opus-5" }],
      issues: [{ id: "i1", identifier: "OTO-1", title: "Build the usage dashboard" }],
    },
    ...overrides,
  };
}
