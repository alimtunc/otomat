// @vitest-environment happy-dom
import { NO_USAGE_FILTERS, type UsageFilters } from "@otomat/domain";
import { UsageBreakdown } from "@web/components/usage/breakdown";
import { usageProjectRows } from "@web/lib/usage/breakdown";
import { afterEach, expect, it, vi } from "vitest";

import { findLabelled } from "#support/dom-queries";
import { mount, type Mounted } from "#support/mount";
import { usageDashboardResponse, usageFigures } from "#support/usage";

let view: Mounted | null = null;

async function mountBreakdown(filters: UsageFilters, onSelect = vi.fn()) {
  const rows = usageProjectRows(
    usageDashboardResponse({
      projects: [
        { project_id: "p1", project_name: "First", figures: usageFigures(), runs: 1 },
        {
          project_id: "p2",
          project_name: "Second",
          figures: usageFigures({
            input_tokens: { value: null, reported_turns: 0 },
            output_tokens: { value: null, reported_turns: 0 },
          }),
          runs: 2,
        },
      ],
    }),
  );
  view = await mount(
    <UsageBreakdown
      title="By project"
      rows={rows}
      filters={filters}
      emptyLabel="Nothing here."
      onSelect={onSelect}
    />,
  );
  return { rows, onSelect };
}

afterEach(async () => {
  await view?.cleanup();
  view = null;
});

it("drills into the slice a reader picks", async () => {
  const { rows, onSelect } = await mountBreakdown(NO_USAGE_FILTERS);

  findLabelled("First: 1.54k tokens, $0.02, 1 run(s)")?.click();

  expect(onSelect).toHaveBeenCalledWith(rows[0]);
});

it("marks the slice the filters already stand on", async () => {
  await mountBreakdown({ ...NO_USAGE_FILTERS, projects: ["p1"] });

  expect(findLabelled("First: 1.54k tokens, $0.02, 1 run(s)")?.getAttribute("aria-pressed")).toBe(
    "true",
  );
});

it("says a slice reported no tokens rather than drawing it as zero", async () => {
  await mountBreakdown(NO_USAGE_FILTERS);

  expect(findLabelled("Second: no tokens reported, $0.02, 2 run(s)")?.textContent).toContain(
    "Not reported",
  );
});

it("keeps an empty breakdown explicit", async () => {
  view = await mount(
    <UsageBreakdown
      title="By project"
      rows={[]}
      filters={NO_USAGE_FILTERS}
      emptyLabel="Nothing here."
      onSelect={vi.fn()}
    />,
  );

  expect(view.container.textContent).toContain("Nothing here.");
});
