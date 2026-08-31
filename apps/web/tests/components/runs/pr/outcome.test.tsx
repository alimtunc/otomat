// @vitest-environment happy-dom

import { PullRequestOutcome } from "@web/components/runs/pr/outcome";
import { pullRequestFixture } from "@web/gallery/gallery.fixtures";
import { describe, expect, it } from "vitest";

import { mountRouted } from "#support/router";

describe("PullRequestOutcome", () => {
  it("shows an immutable summary with no inputs, no AI generation and no dead control", async () => {
    const view = await mountRouted(
      <PullRequestOutcome
        pullRequest={pullRequestFixture({ status: "merged" })}
        runId="run-1"
        issueTitle="Centraliser la prochaine action"
        hasWorktree={false}
      />,
    );

    expect(view.container.querySelectorAll("input, textarea, select").length).toBe(0);
    expect(view.container.textContent).not.toContain("with AI");
    for (const control of view.container.querySelectorAll("button, a")) {
      expect(control.hasAttribute("disabled")).toBe(false);
      expect(control.getAttribute("aria-disabled")).not.toBe("true");
    }
    const github = [...view.container.querySelectorAll("a")].find(
      (anchor) => anchor.getAttribute("href") === "https://github.com/alimtunc/otomat/pull/183",
    );
    expect(github?.textContent).toContain("Open pull request #183 on GitHub");
    expect(view.container.textContent).toContain(
      "The run's worktree was removed — there is no local diff to show.",
    );
    await view.cleanup();
  });

  it("keeps the diff reachable while the worktree still exists", async () => {
    const view = await mountRouted(
      <PullRequestOutcome
        pullRequest={pullRequestFixture({ status: "closed" })}
        runId="run-1"
        issueTitle="Centraliser la prochaine action"
        hasWorktree={true}
      />,
    );
    const diff = [...view.container.querySelectorAll("a")].find(
      (anchor) => anchor.textContent === "View diff",
    );
    expect(diff?.getAttribute("href")).toBe("/runs/run-1/diff");
    await view.cleanup();
  });
});
