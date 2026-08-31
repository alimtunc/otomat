// @vitest-environment happy-dom
import { UsageSummary } from "@web/components/usage/summary";
import { afterEach, expect, it } from "vitest";

import { mount, type Mounted } from "#support/mount";
import { usageFigures } from "#support/usage";

let view: Mounted | null = null;

function totals(
  figures = usageFigures(),
  duration = { total_ms: 3_600_000, measured_runs: 1, unmeasured_runs: 0 },
) {
  return { figures, runs: 1, steps: 2, duration };
}

afterEach(async () => {
  await view?.cleanup();
  view = null;
});

it("states a reported total with the turns behind it", async () => {
  view = await mount(<UsageSummary totals={totals()} />);

  expect(view.container.textContent).toContain("1.2k");
  expect(view.container.textContent).toContain("$0.02");
  expect(view.container.textContent).toContain("1h 0m");
});

it("says a metric was not reported instead of showing a zero", async () => {
  view = await mount(
    <UsageSummary
      totals={totals(usageFigures({ cost_usd: { value: null, reported_turns: 0 } }), {
        total_ms: null,
        measured_runs: 0,
        unmeasured_runs: 2,
      })}
    />,
  );

  expect(view.container.textContent).toContain("Not reported");
  expect(view.container.textContent).toContain("Not measured");
  expect(view.container.textContent).toContain("2 run(s) not measured");
  expect(view.container.textContent).not.toContain("$0");
});

it("marks a metric only some turns reported with an explicit partial signal", async () => {
  view = await mount(
    <UsageSummary
      totals={totals(usageFigures({ cost_usd: { value: 0.021, reported_turns: 1 } }))}
    />,
  );

  expect(
    view.container.querySelector('[aria-label="Partial: 1 of 2 turns reported this figure"]'),
  ).not.toBeNull();
});

it("counts the turns whose payload could not be read", async () => {
  view = await mount(<UsageSummary totals={totals(usageFigures({ unreadable_turns: 1 }))} />);

  expect(view.container.textContent).toContain("1 unreadable payload(s)");
});
