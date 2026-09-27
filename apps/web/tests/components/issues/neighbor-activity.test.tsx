// @vitest-environment happy-dom
import { CLOSED_ISSUE_WORKSPACE, type RunState } from "@otomat/domain";
import { hostKeys } from "@web/api/query-keys";
import { IssueNeighborActivity } from "@web/components/issues/relations/activity";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { issueContract, openWorkspace } from "#support/issue";
import { mountWithQuery, type Mounted } from "#support/mount";
import { testQueryClient } from "#support/query";

const readIssue = vi.fn();
vi.mock("@web/api/client", () => ({ daemon: { getIssue: (id: string) => readIssue(id) } }));

let mounted: Mounted | undefined;
afterEach(async () => {
  await mounted?.cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});

it.each([
  ["running", "Running"],
  ["awaiting_permission", "Awaiting permission"],
  ["awaiting_human", "Awaiting human"],
  ["waiting_for_provider", "Waiting on provider"],
  ["review_ready", "Review ready"],
  ["failed", "Failed"],
] satisfies [RunState, string][])("shows the holding run's %s state", async (status, label) => {
  readIssue.mockResolvedValue(issueContract({ workspace: openWorkspace("current-run", status) }));
  mounted = await mountWithQuery(<IssueNeighborActivity issueId="issue-1" />);
  expect(mounted.container.textContent).toContain(label);
  if (status !== "running") expect(mounted.container.textContent).not.toContain("Running");
  if (status !== "failed") expect(mounted.container.textContent).not.toContain("Failed");
});

it("hides a historical failure after the canonical workspace closes", async () => {
  readIssue.mockResolvedValue(
    issueContract({
      workspace: CLOSED_ISSUE_WORKSPACE,
      execution: { state: "failed", run_id: "old-run", failure: { reason: "failed", step: null } },
    }),
  );
  mounted = await mountWithQuery(<IssueNeighborActivity issueId="issue-1" />);
  expect(mounted.container.textContent).toBe("");
});

it("shows a locally blocked ticket without inventing a run", async () => {
  readIssue.mockResolvedValue(issueContract({ status: "blocked" }));
  mounted = await mountWithQuery(<IssueNeighborActivity issueId="issue-1" />);
  expect(mounted.container.textContent).toContain("Blocked");
  expect(mounted.container.textContent).not.toContain("Run");
});

it("refreshes a neighbor's activity and retains it with a stale notice on failure", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  const client = testQueryClient();
  readIssue.mockResolvedValue(issueContract({ workspace: openWorkspace("run", "running") }));
  mounted = await mountWithQuery(<IssueNeighborActivity issueId="issue-1" />, client);
  expect(mounted.container.textContent).toContain("Running");
  readIssue.mockResolvedValue(
    issueContract({ workspace: openWorkspace("run", "awaiting_permission") }),
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000);
  });
  await vi.waitFor(() => expect(mounted?.container.textContent).toContain("Awaiting permission"));
  expect(mounted.container.textContent).not.toContain("Running");
  readIssue.mockRejectedValue(new Error("Offline"));
  await act(async () => {
    await client.invalidateQueries({ queryKey: hostKeys("local").issue("issue-1") });
  });
  await vi.waitFor(() => expect(mounted?.container.textContent).toContain("Couldn’t refresh"));
  expect(mounted.container.textContent).toContain("Awaiting permission");
});

it("reports an unavailable activity instead of claiming there is no run", async () => {
  readIssue.mockRejectedValue(new Error("Offline"));
  mounted = await mountWithQuery(<IssueNeighborActivity issueId="issue-1" />);
  expect(mounted.container.textContent).toContain("Activity unavailable");
});
