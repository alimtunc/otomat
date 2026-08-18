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

it("separates a live total from a final one", async () => {
  view = await mount(<UsageTokens usage={reportedUsage({ availability: "live" })} />);
  expect(view.container.textContent).toContain("live");

  await view.cleanup();
  view = await mount(<UsageTokens usage={reportedUsage({ availability: "final" })} />);
  expect(view.container.textContent).toContain("final");
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
