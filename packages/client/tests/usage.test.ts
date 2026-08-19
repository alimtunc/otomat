import type { UsageFilters } from "@otomat/domain";
import { expect, it } from "vitest";

import { createDaemonClient } from "#client/client/index";

import { jsonResponse } from "./support/response.js";

const EMPTY_METRIC = { value: null, reported_turns: 0 };
const FIGURES = {
  turns: 0,
  unreadable_turns: 0,
  input_tokens: EMPTY_METRIC,
  output_tokens: EMPTY_METRIC,
  cost_usd: EMPTY_METRIC,
};

const DASHBOARD = {
  range: { from: null, to: "2026-08-10T12:00:00.000Z" },
  totals: {
    figures: FIGURES,
    runs: 0,
    steps: 0,
    duration: { total_ms: null, measured_runs: 0, unmeasured_runs: 0 },
  },
  daily: [],
  projects: [],
  emitters: [],
  runs: [],
  options: { projects: [], emitters: [], issues: [] },
};

async function capturedUrl(filters: UsageFilters): Promise<string> {
  let url = "";
  const client = createDaemonClient({
    baseUrl: "http://localhost:4319",
    fetch: async (input) => {
      url = String(input);
      return jsonResponse(DASHBOARD);
    },
  });
  await client.getUsageDashboard(filters);
  return url;
}

it("repeats a key per selected value, so a multi-value axis survives the query string", async () => {
  const url = await capturedUrl({
    period: "7d",
    day: "2026-08-10",
    projects: ["p1", "p2"],
    runtimes: [],
    models: [""],
    issues: ["i1"],
  });

  expect(url).toBe(
    "http://localhost:4319/api/usage?period=7d&day=2026-08-10&projects=p1&projects=p2&models=&issues=i1",
  );
});

it("leaves an unnarrowed axis out of the query instead of sending it empty", async () => {
  const url = await capturedUrl({
    period: "30d",
    day: null,
    projects: [],
    runtimes: [],
    models: [],
    issues: [],
  });

  expect(url).toBe("http://localhost:4319/api/usage?period=30d");
});
