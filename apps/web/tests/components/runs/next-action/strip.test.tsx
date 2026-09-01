// @vitest-environment happy-dom

import { NextActionStrip } from "@web/components/runs/next-action/strip";
import {
  pullRequestDetailFixture,
  pullRequestFixture,
  runDetailFixture,
} from "@web/gallery/gallery.fixtures";
import { describe, expect, it } from "vitest";

import { mountRouted } from "#support/router";

describe("NextActionStrip", () => {
  it("announces the state change politely and offers exactly one action", async () => {
    const view = await mountRouted(
      <NextActionStrip detail={runDetailFixture("review_ready")} pullRequest={undefined} />,
    );
    const region = view.container.querySelector('[aria-live="polite"]');
    expect(region?.textContent).toContain("ready for review");
    const actions = view.container.querySelectorAll("a, button");
    expect(actions.length).toBe(1);
    expect(actions[0]?.textContent).toBe("Review the diff");
    expect(actions[0]?.getAttribute("href")).toBe("/runs/run-1/diff");
    await view.cleanup();
  });

  it("links the open pull request on GitHub", async () => {
    const view = await mountRouted(
      <NextActionStrip
        detail={runDetailFixture("completed")}
        pullRequest={pullRequestDetailFixture(pullRequestFixture({}))}
      />,
    );
    const link = view.container.querySelector("a");
    expect(link?.textContent).toBe("Open PR #183");
    expect(link?.getAttribute("href")).toBe("https://github.com/alimtunc/otomat/pull/183");
    expect(link?.getAttribute("target")).toBe("_blank");
    await view.cleanup();
  });

  it("offers nothing on a merged outcome", async () => {
    const view = await mountRouted(
      <NextActionStrip
        detail={runDetailFixture("completed")}
        pullRequest={pullRequestDetailFixture(pullRequestFixture({ status: "merged" }))}
      />,
    );
    expect(view.container.textContent).toContain("PR #183 is merged");
    expect(view.container.querySelectorAll("a, button").length).toBe(0);
    await view.cleanup();
  });

  it("deep-links the failing step", async () => {
    const view = await mountRouted(
      <NextActionStrip
        detail={runDetailFixture("failed", [{ id: "s9", status: "failed" }])}
        pullRequest={undefined}
      />,
    );
    const link = view.container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/runs/run-1?step=s9");
    await view.cleanup();
  });
});
