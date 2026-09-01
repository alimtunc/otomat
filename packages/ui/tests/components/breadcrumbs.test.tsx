// @vitest-environment happy-dom
import { Breadcrumbs } from "@otomat/ui";
import { afterEach, describe, expect, it } from "vitest";

import { render, unmountAll } from "#test-support/render";

const ISSUE_CRUMB = "OTO-1 · Fix the responsive page chrome";
const RUN_CRUMBS = [
  { label: "Runs", href: "/runs" },
  { label: ISSUE_CRUMB, href: "/issues/oto-1" },
  { label: "Run", current: true },
];

function crumbs(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>("nav > span")];
}

function classesOf(element: HTMLElement): string[] {
  return element.className.split(" ");
}

describe("Breadcrumbs", () => {
  afterEach(async () => {
    await unmountAll();
  });

  it("lets only the longest crumb shrink", async () => {
    const container = await render(<Breadcrumbs items={RUN_CRUMBS} />);
    const [runs, issue, run] = crumbs(container).map(classesOf);
    expect(runs).toContain("flex-none");
    expect(issue).toContain("min-w-0");
    expect(run).toContain("flex-none");
  });

  it("carries the full value of the crumb it truncates", async () => {
    const container = await render(<Breadcrumbs items={RUN_CRUMBS} />);
    const titles = crumbs(container).map((span) => span.getAttribute("title"));
    expect(titles).toEqual([null, ISSUE_CRUMB, null]);
  });

  it("keeps the clip on the inline link the crumb blockifies", async () => {
    const container = await render(<Breadcrumbs items={RUN_CRUMBS} />);
    const shrinking = crumbs(container)[1];
    expect(shrinking?.firstElementChild?.className).toContain("truncate");
  });
});
