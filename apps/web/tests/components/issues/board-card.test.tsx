// @vitest-environment happy-dom
import type { IssueContract } from "@otomat/domain";
import { BoardCard } from "@web/components/issues/list/board-card";
import { afterEach, expect, it } from "vitest";

import { issueContract, openWorkspace } from "#support/issue";
import { type Mounted } from "#support/mount";
import { mountRouted } from "#support/router";

const mounted: Mounted[] = [];

afterEach(async () => {
  for (const entry of mounted.splice(0)) await entry.cleanup();
  document.body.replaceChildren();
});

async function renderCard(issue: IssueContract): Promise<HTMLElement> {
  const rendered = await mountRouted(<BoardCard issue={issue} />);
  mounted.push(rendered);
  return rendered.container;
}

it("keeps the execution of an open cycle readable under a status marked done", async () => {
  const container = await renderCard(
    issueContract({
      status: "done",
      execution: { state: "running", run_id: "run-1" },
      workspace: openWorkspace("run-1", "running"),
    }),
  );

  expect(container.textContent).toContain("Running");
});

it("names no execution once the cycle behind a done issue is closed", async () => {
  const container = await renderCard(
    issueContract({ status: "done", execution: { state: "running", run_id: "run-1" } }),
  );

  expect(container.textContent).not.toContain("Running");
});

it("names the divergent source status alone while the execution owns the card", async () => {
  const container = await renderCard(
    issueContract({
      status: "backlog",
      execution: { state: "reviewing", run_id: "run-1" },
      workspace: openWorkspace("run-1", "review_ready"),
    }),
  );

  expect(container.textContent).toContain("Backlog");
  expect(container.textContent).not.toContain("Reviewing");
});

it("names a run blocked on a question as waiting on you and opens straight on the question", async () => {
  const container = await renderCard(
    issueContract({
      status: "running",
      execution: {
        state: "awaiting_input",
        run_id: "run-1",
        request: { id: "q-1", step_run_id: "step-2" },
      },
      workspace: openWorkspace("run-1", "awaiting_permission"),
    }),
  );

  expect(container.textContent).toContain("Waiting on you");
  expect(container.textContent).not.toContain("Running");
  expect(container.querySelector("a")?.getAttribute("href")).toBe(
    "/issues/issue-1?run=run-1&step=step-2#interaction-q-1",
  );
});

it("opens a wait no runtime asked on the issue itself", async () => {
  const container = await renderCard(
    issueContract({
      execution: { state: "awaiting_input", run_id: "run-1", request: null },
      workspace: openWorkspace("run-1", "awaiting_selection"),
    }),
  );

  expect(container.textContent).toContain("Waiting on you");
  expect(container.querySelector("a")?.getAttribute("href")).toBe("/issues/issue-1");
});
