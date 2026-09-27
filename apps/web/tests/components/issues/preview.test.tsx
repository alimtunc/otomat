// @vitest-environment happy-dom
import type { LinearIssueRelations } from "@otomat/domain";
import { hostKeys } from "@web/api/query-keys";
import { BoardCard } from "@web/components/issues/list/board-card";
import { IssuePreviewCard } from "@web/components/issues/preview/card";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { issueContract, linearIssueContract, openWorkspace } from "#support/issue";
import { mountWithQuery, type Mounted } from "#support/mount";
import { testQueryClient } from "#support/query";
import { mountRoutedWithQuery } from "#support/router";

const readRelations = vi.fn();
vi.mock("@web/api/client", () => ({
  daemon: {
    getLinearRelations: (id: string) => readRelations(id),
    getIssue: (id: string) => Promise.resolve(issueContract({ id })),
  },
}));
const issue = linearIssueContract({
  source_identifier: "OTO-42",
  title: "Add the issue preview",
  source_state_name: "In progress",
  source_assignee_name: "Alim",
  source_priority: 2,
  workspace: openWorkspace("current-run", "running"),
});
const relations: LinearIssueRelations = {
  parent: null,
  children: [],
  relations: [
    {
      id: "blocker",
      type: "blocked_by",
      issue: {
        external_id: "external",
        issue_id: "blocker",
        identifier: "OTO-41",
        title: "Ship the API first",
        url: "https://linear.app/test/issue/OTO-41",
        state: { id: "state", type: "started", name: "In progress", color: "#f2c94c" },
        priority: 2,
        assignee: null,
      },
    },
  ],
  checked_at: "2026-09-27T09:40:00.000Z",
};
let mounted: Mounted | undefined;
afterEach(async () => {
  await mounted?.cleanup();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

async function focusIssue() {
  const link = document.querySelector<HTMLAnchorElement>(`a[href="/issues/${issue.id}"]`);
  if (link === null) throw new Error("Issue link missing");
  const matches = link.matches.bind(link);
  vi.spyOn(link, "matches").mockImplementation(
    (selector) => selector === ":focus-visible" || matches(selector),
  );
  await act(async () => link.focus());
  return link;
}

async function expandRelations() {
  const trigger = document.querySelector<HTMLButtonElement>('button[aria-expanded="false"]');
  if (trigger === null) throw new Error("Relations disclosure missing");
  await act(async () => trigger.click());
}

it("keeps the focused link when its issue finishes loading", async () => {
  readRelations.mockResolvedValue({ ...relations, relations: [] });
  mounted = await mountWithQuery(
    <IssuePreviewCard issue={null}>
      <a href={`/issues/${issue.id}`}>Issue not loaded</a>
    </IssuePreviewCard>,
  );
  const link = await focusIssue();
  expect(readRelations).not.toHaveBeenCalled();
  await mounted.rerender(
    <IssuePreviewCard issue={issue}>
      <a href={`/issues/${issue.id}`}>{issue.title}</a>
    </IssuePreviewCard>,
  );
  expect(mounted.container.querySelector("a")).toBe(link);
  expect(document.activeElement).toBe(link);
  await vi.waitFor(() => expect(document.body.textContent).toContain("No linked issues"));
});

it("previews the ticket first, expands its relations on demand and preserves navigation", async () => {
  readRelations.mockResolvedValue({ ...relations, parent: relations.relations[0]?.issue ?? null });
  mounted = await mountRoutedWithQuery(<BoardCard issue={issue} />);
  expect(mounted.container.querySelector("button")).toBeNull();
  expect(readRelations).not.toHaveBeenCalled();
  const link = await focusIssue();
  await vi.waitFor(() => expect(document.body.textContent).toContain("1 linked issue"));
  const preview = document.querySelector('[role="dialog"]');
  expect(preview?.textContent).toContain("Add the issue preview");
  expect(preview?.textContent).toContain("In progress");
  expect(preview?.textContent).toContain("Alim");
  expect(preview?.textContent).toContain("High");
  expect(preview?.textContent).toContain("Running");
  expect(preview?.textContent).toContain("Blocked by 1");
  expect(preview?.textContent).not.toContain("Ship the API first");
  expect(readRelations).toHaveBeenCalledTimes(1);
  await expandRelations();
  await vi.waitFor(() => expect(document.body.textContent).toContain("Ship the API first"));
  expect(document.querySelector('a[href="/issues/blocker"]')).not.toBeNull();
  expect(link.getAttribute("role")).toBeNull();
  await act(async () => link.click());
  await vi.waitFor(() => expect(mounted?.container.querySelector("a")).toBeNull());
});

it("retains last-known links behind the stale notice when opening offline", async () => {
  const client = testQueryClient();
  client.setQueryData(hostKeys("local").linearRelations(issue.id), relations);
  readRelations.mockRejectedValue(new Error("Offline"));
  mounted = await mountRoutedWithQuery(<BoardCard issue={issue} />, client);
  expect(readRelations).not.toHaveBeenCalled();
  await focusIssue();
  await vi.waitFor(() => expect(document.body.textContent).toContain("Couldn’t refresh"));
  expect(document.body.textContent).toContain("1 linked issue");
  await expandRelations();
  await vi.waitFor(() => expect(document.body.textContent).toContain("Ship the API first"));
  expect(document.body.textContent).not.toContain("No linked issues");
});

it("distinguishes unavailable relations from a confirmed empty result", async () => {
  readRelations.mockRejectedValue(new Error("Offline"));
  mounted = await mountRoutedWithQuery(<BoardCard issue={issue} />);
  await focusIssue();
  await vi.waitFor(() => expect(document.body.textContent).toContain("Relations unavailable"));
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Add the issue preview");
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Alim");
  expect(document.body.textContent).not.toContain("No linked issues");
  await mounted.cleanup();
  readRelations.mockResolvedValue({ ...relations, relations: [] });
  mounted = await mountRoutedWithQuery(<BoardCard issue={issue} />);
  await focusIssue();
  await vi.waitFor(() => expect(document.body.textContent).toContain("No linked issues"));
});

it("previews local tickets without asking Linear for relations", async () => {
  mounted = await mountRoutedWithQuery(
    <BoardCard issue={issueContract({ id: issue.id, title: "Local issue" })} />,
  );
  await focusIssue();
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Local issue");
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain("No active run");
  expect(readRelations).not.toHaveBeenCalled();
});
