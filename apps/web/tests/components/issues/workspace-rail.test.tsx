// @vitest-environment happy-dom
import type { IssueContract, IssueExecution } from "@otomat/domain";
import { IssueMetadata } from "@web/components/issues/issue/metadata";
import { WorkspaceRail } from "@web/components/issues/workspace/rail/workspace-rail";
import { afterEach, expect, it } from "vitest";

import { issueContract, openWorkspace } from "#support/issue";
import { type Mounted } from "#support/mount";
import { withQueryClient } from "#support/query";
import { mountRouted } from "#support/router";

const mounted: Mounted[] = [];

const REVIEWING: IssueExecution = { state: "reviewing", run_id: "run-1" };

afterEach(async () => {
  for (const entry of mounted.splice(0)) await entry.cleanup();
  document.body.replaceChildren();
});

async function render(issue: IssueContract): Promise<HTMLElement> {
  const rendered = await mountRouted(
    withQueryClient(
      <>
        <IssueMetadata issue={issue} />
        <WorkspaceRail issue={issue} run={null} />
      </>,
    ),
  );
  mounted.push(rendered);
  return rendered.container;
}

function rowValue(container: HTMLElement, label: string): string {
  const terms = [...container.querySelectorAll("dt")];
  const term = terms.find((entry) => entry.textContent === label);
  if (term === undefined) throw new Error(`no rail row labelled ${label}`);
  return term.nextElementSibling?.textContent?.trim() ?? "";
}

it("names execution in the header and keeps the issue control in the rail", async () => {
  const container = await render(
    issueContract({
      status: "backlog",
      execution: REVIEWING,
      workspace: openWorkspace("run-1", "review_ready"),
    }),
  );

  expect(rowValue(container, "Issue status")).toBe("Backlog");
  expect(container.querySelector('[aria-label="Execution: reviewing"]')?.textContent).toBe(
    "Reviewing",
  );
  expect(
    [...container.querySelectorAll("dt")].some((term) => term.textContent === "Execution"),
  ).toBe(false);
});

it("stops naming an execution once the cycle is closed", async () => {
  const container = await render(issueContract({ status: "ready", execution: REVIEWING }));

  expect(rowValue(container, "Issue status")).toBe("Ready");
  expect(container.querySelector('[aria-label^="Execution:"]')).toBeNull();
});

it("keeps the stopped cycle of a done issue readable in the rail", async () => {
  const container = await render(
    issueContract({
      status: "done",
      execution: {
        state: "failed",
        run_id: "run-1",
        failure: { reason: "failed", step: { id: "step-1", name: "Reviewer" } },
      },
      workspace: openWorkspace("run-1", "failed"),
    }),
  );

  expect(rowValue(container, "Issue status")).toBe("Done");
  expect(container.querySelector('[aria-label="Execution: failed"]')?.textContent).toBe("Failed");
  expect(container.textContent).toContain("Failed at Reviewer");
});
