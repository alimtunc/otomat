// @vitest-environment happy-dom

import type { IssueContract } from "@otomat/domain";
import { IssuesTable } from "@web/components/issues/list/table";
import { groupIssues } from "@web/lib/issue/grouping";
import { afterEach, expect, it, vi } from "vitest";

import { issueContract, openWorkspace } from "#support/issue";
import { mockListViewport } from "#support/list-viewport";
import { type Mounted } from "#support/mount";
import { mountRouted } from "#support/router";

const mounted: Mounted[] = [];

afterEach(async () => {
  for (const entry of mounted.splice(0)) await entry.cleanup();
  document.body.replaceChildren();
});

async function renderRow(issue: IssueContract): Promise<HTMLElement> {
  const rendered = await mountRouted(
    <IssuesTable
      groups={groupIssues([issue], "none", new Map())}
      showGroupHeadings={false}
      collapsed={[]}
      onToggleGroup={vi.fn()}
    />,
  );
  mounted.push(rendered);
  return rendered.container;
}

it("names the execution of an open cycle next to the untouched source status", async () => {
  const container = await renderRow(
    issueContract({
      status: "backlog",
      execution: { state: "reviewing", run_id: "run-1" },
      workspace: openWorkspace("run-1", "review_ready"),
    }),
  );

  expect(container.textContent).toContain("Backlog");
  expect(container.textContent).toContain("Reviewing");
});

it("names a wait on the operator and opens the row on the pending question", async () => {
  const container = await renderRow(
    issueContract({
      status: "backlog",
      execution: {
        state: "awaiting_input",
        run_id: "run-1",
        request: { id: "q-1", step_run_id: "step-2" },
      },
      workspace: openWorkspace("run-1", "awaiting_permission"),
    }),
  );

  expect(container.textContent).toContain("Waiting on you");
  expect(container.querySelector("a")?.getAttribute("href")).toBe(
    "/issues/issue-1?run=run-1&step=step-2#interaction-q-1",
  );
});

it("leaves a running status to the wait that speaks for it", async () => {
  const container = await renderRow(
    issueContract({
      status: "running",
      execution: { state: "awaiting_input", run_id: "run-1", request: null },
      workspace: openWorkspace("run-1", "awaiting_permission"),
    }),
  );

  expect(container.textContent).toContain("Waiting on you");
  expect(container.textContent).not.toContain("Running");
});

it("stops naming the execution of a cycle an abandon closed", async () => {
  const container = await renderRow(
    issueContract({ status: "backlog", execution: { state: "reviewing", run_id: "run-1" } }),
  );

  expect(container.textContent).toContain("Backlog");
  expect(container.textContent).not.toContain("Reviewing");
});

it("hides optional columns and a status already named by every group", async () => {
  const rendered = await mountRouted(
    <IssuesTable
      groups={groupIssues([issueContract({ status: "backlog" })], "status", new Map())}
      showGroupHeadings
      collapsed={[]}
      onToggleGroup={vi.fn()}
    />,
  );
  mounted.push(rendered);
  const headers = [...rendered.container.querySelectorAll("thead th")].map(
    (node) => node.textContent,
  );
  expect(headers).not.toContain("Status");
  expect(headers).not.toContain("Source");
  expect(headers).not.toContain("Assignee");
  expect(rendered.container.textContent?.match(/Backlog/g)).toHaveLength(1);
});

it("restores selected optional columns without hiding a different source status", async () => {
  const issue = issueContract({
    status: "backlog",
    execution: { state: "reviewing", run_id: "run-1" },
    workspace: openWorkspace("run-1", "review_ready"),
  });
  const rendered = await mountRouted(
    <IssuesTable
      groups={groupIssues([issue], "status", new Map())}
      showGroupHeadings
      optionalColumns={["source", "assignee"]}
      collapsed={[]}
      onToggleGroup={vi.fn()}
    />,
  );
  mounted.push(rendered);
  const headers = [...rendered.container.querySelectorAll("thead th")].map(
    (node) => node.textContent,
  );
  expect(headers).toContain("Source");
  expect(headers).toContain("Assignee");
});

mockListViewport();
