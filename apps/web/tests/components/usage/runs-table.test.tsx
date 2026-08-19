// @vitest-environment happy-dom
import { UsageRunsTable } from "@web/components/usage/runs-table";
import { afterEach, expect, it } from "vitest";

import type { Mounted } from "#support/mount";
import { mountRouted } from "#support/router";
import { usageDashboardResponse, usageFigures, usageRunRow } from "#support/usage";

let view: Mounted | null = null;

afterEach(async () => {
  await view?.cleanup();
  view = null;
});

it("keeps the run and its issue reachable from the detail row", async () => {
  view = await mountRouted(<UsageRunsTable rows={[usageRunRow()]} total={1} />);

  const links = [...view.container.querySelectorAll("a")].map((link) => link.getAttribute("href"));

  expect(links).toContain("/runs/run-1234abcd");
  expect(links).toContain("/issues/i1");
  expect(view.container.textContent).toContain("OTO-1");
});

it("states the figures a run reported and the ones it did not", async () => {
  view = await mountRouted(
    <UsageRunsTable
      rows={[
        usageRunRow({
          duration_ms: null,
          emitters: [{ runtime: "codex", model: null }],
          figures: usageFigures({ cost_usd: { value: null, reported_turns: 0 } }),
        }),
      ]}
      total={1}
    />,
  );

  expect(view.container.textContent).toContain("in 1.2k");
  expect(view.container.textContent).toContain("codex · Model not reported");
  expect(view.container.textContent).toContain("Not measured");
  expect(view.container.textContent).toContain("Not reported");
});

it("says how many runs the page left out instead of implying it holds them all", async () => {
  view = await mountRouted(<UsageRunsTable rows={usageDashboardResponse().runs} total={120} />);

  expect(view.container.textContent).toContain("Showing the 1 most recent of 120 runs");
});
