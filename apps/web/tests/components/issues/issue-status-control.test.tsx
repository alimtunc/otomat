// @vitest-environment happy-dom
import type { IssueContract } from "@otomat/domain";
import { IssueStatusControl } from "@web/components/issues/workspace/rail/issue-status-control";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { issueContract, linearIssueContract, openWorkspace } from "#support/issue";
import { mount, type Mounted } from "#support/mount";

const mutate = vi.fn();
let refusal: Error | null = null;

vi.mock("@web/api/issues/mutations", () => ({
  useSetIssueStatus: () => ({
    mutate,
    isPending: false,
    isError: refusal !== null,
    error: refusal,
  }),
  issueStatusErrorMessage: () => refusal?.message ?? "",
}));

const mounted: Mounted[] = [];

afterEach(async () => {
  for (const entry of mounted.splice(0)) await entry.cleanup();
  mutate.mockReset();
  refusal = null;
  document.body.replaceChildren();
});

async function render(issue: IssueContract): Promise<HTMLElement> {
  const entry = await mount(<IssueStatusControl issue={issue} />);
  mounted.push(entry);
  return entry.container;
}

async function open(issue: IssueContract): Promise<string[]> {
  const container = await render(issue);
  const trigger = container.querySelector("button");
  if (trigger === null) throw new Error("the issue status trigger is missing");
  await act(async () => trigger.click());
  return [...document.querySelectorAll<HTMLElement>("[role='menuitem']")].map(
    (item) => item.textContent?.trim() ?? "",
  );
}

async function choose(issue: IssueContract, label: string): Promise<void> {
  await open(issue);
  const item = [...document.querySelectorAll<HTMLElement>("[role='menuitem']")].find(
    (entry) => entry.textContent?.trim() === label,
  );
  if (item === undefined) throw new Error(`the ${label} item is missing`);
  await act(async () => item.click());
}

it("offers only the manual statuses, never an execution one", async () => {
  const items = await open(
    issueContract({
      status: "backlog",
      execution: { state: "running", run_id: "run-1" },
      workspace: openWorkspace("run-1", "running"),
    }),
  );

  expect(items).toEqual(["Mark ready", "Mark done"]);
});

it("marks the issue done without touching its live run", async () => {
  await choose(
    issueContract({
      status: "ready",
      execution: { state: "running", run_id: "run-1" },
      workspace: openWorkspace("run-1", "running"),
    }),
    "Mark done",
  );

  expect(mutate).toHaveBeenCalledWith({ status: "done" });
});

it("reopens a done issue as ready", async () => {
  const items = await open(issueContract({ status: "done" }));
  expect(items).toEqual(["Mark ready"]);

  await choose(issueContract({ status: "done" }), "Mark ready");
  expect(mutate).toHaveBeenCalledWith({ status: "ready" });
});

it("leaves a mirrored issue's status to its tracker", async () => {
  const container = await render(linearIssueContract({ status: "backlog" }));

  expect(container.querySelector("button")).toBeNull();
  expect(container.textContent).toContain("Backlog");
});

it("names the refusal the daemon answered", async () => {
  refusal = new Error("An issue that is canceled cannot be marked ready.");
  const container = await render(issueContract({ status: "ready" }));

  expect(container.querySelector("[role='alert']")?.textContent).toBe(
    "An issue that is canceled cannot be marked ready.",
  );
});
