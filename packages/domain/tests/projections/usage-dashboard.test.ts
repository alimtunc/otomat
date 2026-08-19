import {
  NO_USAGE_FILTERS,
  usageDashboard,
  usageMetricState,
  usageTokenMetric,
  type UsageDashboardInput,
  type UsageRunEvidence,
  type UsageTurnEvidence,
} from "@otomat/domain";
import { expect, it } from "vitest";

const RANGE = { from: "2026-08-01T00:00:00.000Z", to: "2026-08-31T00:00:00.000Z" };

function turn(overrides: Partial<UsageTurnEvidence> = {}): UsageTurnEvidence {
  return {
    run_id: "r1",
    step_run_id: "s1",
    day: "2026-08-10",
    last_occurred_at: "2026-08-10T10:00:00.000Z",
    runtime: "claude",
    model: "claude-opus-5",
    turns: 1,
    unreadable_turns: 0,
    input_tokens: 100,
    input_turns: 1,
    output_tokens: 10,
    output_turns: 1,
    cost_usd: null,
    cost_turns: 0,
    ...overrides,
  };
}

function run(overrides: Partial<UsageRunEvidence> = {}): UsageRunEvidence {
  return {
    run_id: "r1",
    status: "completed",
    started_at: null,
    completed_at: null,
    project_id: "p1",
    project_name: "First",
    issue_id: "i1",
    issue_identifier: "OTO-1",
    issue_title: "Issue",
    ...overrides,
  };
}

function project(input: Partial<UsageDashboardInput> = {}) {
  return usageDashboard({
    range: RANGE,
    turns: [turn()],
    runs: [run()],
    filters: NO_USAGE_FILTERS,
    runLimit: 100,
    ...input,
  });
}

it("sums a metric only over the turns that reported it", () => {
  const dashboard = project({
    turns: [
      turn({ input_tokens: 100, input_turns: 1, cost_usd: 0.5, cost_turns: 1 }),
      turn({ input_tokens: 40, input_turns: 1 }),
    ],
  });

  expect(dashboard.totals.figures.input_tokens).toEqual({ value: 140, reported_turns: 2 });
  expect(dashboard.totals.figures.cost_usd).toEqual({ value: 0.5, reported_turns: 1 });
});

it("separates a full total from a partial one and from an absent one", () => {
  expect(usageMetricState({ value: 10, reported_turns: 2 }, 2)).toBe("reported");
  expect(usageMetricState({ value: 10, reported_turns: 1 }, 2)).toBe("partial");
  expect(usageMetricState({ value: null, reported_turns: 0 }, 2)).toBe("unavailable");
});

it("leaves the comparable size null when neither side of the tokens was reported", () => {
  expect(usageTokenMetric(project().totals.figures)).toEqual({ value: 110, reported_turns: 1 });

  const unreported = project({
    turns: [turn({ input_tokens: null, input_turns: 0, output_tokens: null, output_turns: 0 })],
  });

  expect(usageTokenMetric(unreported.totals.figures)).toEqual({ value: null, reported_turns: 0 });
});

it("keeps the facet options read from the period, not from the narrowed rows", () => {
  const dashboard = project({
    turns: [turn(), turn({ run_id: "r2", runtime: "codex", model: null })],
    runs: [run(), run({ run_id: "r2", project_id: "p2", project_name: "Second", issue_id: "i2" })],
    filters: { ...NO_USAGE_FILTERS, projects: ["p1"] },
  });

  expect(dashboard.totals.runs).toBe(1);
  expect(dashboard.options.projects.map((option) => option.id)).toEqual(["p1", "p2"]);
  expect(dashboard.options.emitters).toHaveLength(2);
  expect(dashboard.options.issues.map((option) => option.id)).toEqual(["i1", "i2"]);
});

it("filters an axis the provider never reported through its own sentinel", () => {
  const dashboard = project({
    turns: [turn(), turn({ run_id: "r2", model: null })],
    runs: [run(), run({ run_id: "r2" })],
    filters: { ...NO_USAGE_FILTERS, models: [""] },
  });

  expect(dashboard.runs.map((row) => row.run_id)).toEqual(["r2"]);
});

it("pages the run table and still says how many runs the window holds", () => {
  const dashboard = project({
    turns: [turn(), turn({ run_id: "r2", last_occurred_at: "2026-08-11T10:00:00.000Z" })],
    runs: [run(), run({ run_id: "r2" })],
    runLimit: 1,
  });

  expect(dashboard.runs.map((row) => row.run_id)).toEqual(["r2"]);
  expect(dashboard.totals.runs).toBe(2);
});

it("counts a step once however many turns it reported", () => {
  const dashboard = project({
    turns: [turn(), turn({ day: "2026-08-11" }), turn({ step_run_id: "s2" })],
  });

  expect(dashboard.totals.steps).toBe(2);
  expect(dashboard.daily.map((bucket) => bucket.day)).toEqual(["2026-08-10", "2026-08-11"]);
});

it("drops a duration whose stamps are missing or out of order", () => {
  const dashboard = project({
    turns: [turn(), turn({ run_id: "r2" })],
    runs: [
      run({ started_at: "2026-08-10T10:00:00.000Z", completed_at: "2026-08-10T09:00:00.000Z" }),
      run({ run_id: "r2", started_at: "2026-08-10T10:00:00.000Z" }),
    ],
  });

  expect(dashboard.totals.duration).toEqual({
    total_ms: null,
    measured_runs: 0,
    unmeasured_runs: 2,
  });
});
