// @vitest-environment happy-dom
import type { IssueContract } from "@otomat/domain";
import { IssuesTable } from "@web/components/issues/list/table";
import { groupIssues } from "@web/lib/issue/grouping";
import { afterEach, expect, it, vi } from "vitest";

import { issueContract, openWorkspace } from "#support/issue";
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

it("stops naming the execution of a cycle an abandon closed", async () => {
  const container = await renderRow(
    issueContract({ status: "backlog", execution: { state: "reviewing", run_id: "run-1" } }),
  );

  expect(container.textContent).toContain("Backlog");
  expect(container.textContent).not.toContain("Reviewing");
});
