// @vitest-environment happy-dom
import type { IssueContract, IssueExecution, IssueState } from "@otomat/domain";
import { IssuePrimaryStateBadge } from "@web/components/issues/issue/primary-state-badge";
import { afterEach, expect, it } from "vitest";

import { issueContract, openWorkspace } from "#support/issue";
import { type Mounted } from "#support/mount";
import { mountRouted } from "#support/router";

const mounted: Mounted[] = [];

const REVIEWING: IssueExecution = { state: "reviewing", run_id: "run-1" };
const PR_OPEN: IssueExecution = { state: "pr_open", run_id: "run-1" };
const FAILED: IssueExecution = {
  state: "failed",
  run_id: "run-1",
  failure: { reason: "failed", step: { id: "step-1", name: "Reviewer" } },
};

afterEach(async () => {
  for (const entry of mounted.splice(0)) await entry.cleanup();
  document.body.replaceChildren();
});

async function render(
  status: IssueState,
  execution: IssueExecution,
  cycle: "open" | "closed",
): Promise<HTMLElement> {
  const overrides: Partial<IssueContract> = { id: "issue-1", status, execution };
  if (cycle === "open") overrides.workspace = openWorkspace("run-1", "review_ready");
  const issue = issueContract(overrides);
  const rendered = await mountRouted(<IssuePrimaryStateBadge issue={issue} />);
  mounted.push(rendered);
  return rendered.container;
}

it("shows the review of an open cycle for an issue the tracker still calls Todo", async () => {
  const container = await render("backlog", REVIEWING, "open");

  expect(container.textContent).toContain("Reviewing");
  expect(container.textContent).not.toContain("Backlog");
});

it("shows the open pull request of an issue the tracker calls In Progress", async () => {
  const container = await render("running", PR_OPEN, "open");

  expect(container.textContent).toContain("PR open");
});

it("opens the run holding the workspace from the execution badge", async () => {
  const container = await render("backlog", REVIEWING, "open");
  const link = container.querySelector("a");

  expect(link?.getAttribute("href")).toBe("/issues/issue-1?run=run-1");
});

it("keeps a done issue done, and unlinked, whatever its last run did", async () => {
  for (const execution of [FAILED, REVIEWING]) {
    const container = await render("done", execution, "open");

    expect(container.textContent).toContain("Done");
    expect(container.querySelector("a")).toBeNull();
  }
});

it("falls back to the business status once the cycle is closed", async () => {
  const container = await render("ready", REVIEWING, "closed");

  expect(container.textContent).toContain("Ready");
  expect(container.querySelector("a")).toBeNull();
});
