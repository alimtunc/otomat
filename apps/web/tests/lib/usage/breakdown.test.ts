import { NO_USAGE_FILTERS } from "@otomat/domain";
import {
  isUsageRowSelected,
  toggleUsageRow,
  usageDayRows,
  usageEmitterRows,
  usageProjectRows,
  usageRowSummary,
} from "@web/lib/usage/breakdown";
import { expect, it } from "vitest";

import { usageDashboardResponse, usageFigures } from "#support/usage";

const DASHBOARD = usageDashboardResponse({
  emitters: [
    { emitter: { runtime: "claude", model: "claude-opus-5" }, figures: usageFigures(), runs: 1 },
    { emitter: { runtime: "codex", model: null }, figures: usageFigures(), runs: 1 },
  ],
});

it("drills a day, a project and an emitter down to the runs behind them", () => {
  const [day] = usageDayRows(DASHBOARD);
  const [project] = usageProjectRows(DASHBOARD);
  const [, codex] = usageEmitterRows(DASHBOARD);

  expect(toggleUsageRow(NO_USAGE_FILTERS, day).day).toBe("2026-08-10");
  expect(toggleUsageRow(NO_USAGE_FILTERS, project).projects).toEqual(["p1"]);
  expect(toggleUsageRow(NO_USAGE_FILTERS, codex)).toMatchObject({
    runtimes: ["codex"],
    models: [""],
  });
});

it("reads a selected slice back out of the filters and lets it be undone", () => {
  const [project] = usageProjectRows(DASHBOARD);
  const narrowed = toggleUsageRow(NO_USAGE_FILTERS, project);

  expect(isUsageRowSelected(narrowed, project)).toBe(true);
  expect(toggleUsageRow(narrowed, project).projects).toEqual([]);
});

it("says what a slice holds, including what it never reported", () => {
  const [day] = usageDayRows(
    usageDashboardResponse({
      daily: [
        {
          day: "2026-08-10",
          figures: usageFigures({
            input_tokens: { value: null, reported_turns: 0 },
            output_tokens: { value: null, reported_turns: 0 },
            cost_usd: { value: null, reported_turns: 0 },
          }),
          runs: 1,
        },
      ],
    }),
  );

  expect(usageRowSummary(day)).toBe("2026-08-10: no tokens reported, no cost reported, 1 run(s)");
});
