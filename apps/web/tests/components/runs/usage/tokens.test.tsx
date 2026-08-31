// @vitest-environment happy-dom
import { UsageTokens } from "@web/components/runs/usage/tokens";
import { afterEach, expect, it } from "vitest";

import { mount, type Mounted } from "#support/mount";
import { reportedUsage } from "#support/usage";

let view: Mounted | null = null;

afterEach(async () => {
  await view?.cleanup();
  view = null;
});

it("marks a still-counting total and leaves a settled one unmarked", async () => {
  view = await mount(<UsageTokens usage={reportedUsage({ availability: "live" })} />);
  expect(view.container.textContent).toContain("counting…");

  await view.cleanup();
  view = await mount(<UsageTokens usage={reportedUsage({ availability: "final" })} />);
  expect(view.container.textContent).not.toContain("counting…");
  expect(view.container.textContent).not.toContain("final");
});

it("exposes the exact token figures on hover", async () => {
  view = await mount(<UsageTokens usage={reportedUsage({ input_tokens: 33_412_001 })} />);

  expect(view.container.textContent).toContain("in 33.4M");
  expect(view.container.querySelector('[title="in 33,412,001 · out 340"]')).not.toBeNull();
});

it("says nothing was reported instead of showing a zero", async () => {
  view = await mount(
    <UsageTokens
      usage={reportedUsage({
        availability: "unavailable",
        input_tokens: null,
        output_tokens: null,
        cost_usd: null,
        turns: 0,
      })}
    />,
  );

  expect(view.container.textContent).toContain("Not reported");
  expect(view.container.textContent).not.toContain("0");
});

it("omits a field the provider never reported rather than inventing one", async () => {
  view = await mount(
    <UsageTokens usage={reportedUsage({ output_tokens: null, cost_usd: null })} />,
  );

  expect(view.container.textContent).toContain("in 1.2k");
  expect(view.container.textContent).not.toContain("out");
  expect(view.container.textContent).not.toContain("$");
});
