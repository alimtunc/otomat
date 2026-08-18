// @vitest-environment happy-dom
import { ReportSection } from "@web/components/runs/report/section";
import { afterEach, expect, it } from "vitest";

import { mount, type Mounted } from "#support/mount";

let view: Mounted | null = null;

afterEach(async () => {
  await view?.cleanup();
  view = null;
});

it("scrolls a long section on its own instead of growing the page", async () => {
  view = await mount(
    <ReportSection title="Steps & runtimes">
      {Array.from({ length: 200 }, (_, index) => (
        <p key={index}>line {index}</p>
      ))}
    </ReportSection>,
  );

  const body = view.container.querySelector('[role="region"]');
  expect(body?.className).toContain("overflow-auto");
  expect(body?.className).toContain("max-h-96");
});

it("names the scrollable region and makes it keyboard reachable", async () => {
  view = await mount(
    <ReportSection title="Errors & interruptions">
      <p>one</p>
    </ReportSection>,
  );

  const body = view.container.querySelector('[role="region"]');
  expect(body?.getAttribute("aria-label")).toBe("Errors & interruptions");
  expect(body?.getAttribute("tabindex")).toBe("0");
});
