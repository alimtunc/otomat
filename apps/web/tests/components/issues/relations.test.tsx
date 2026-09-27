// @vitest-environment happy-dom
import type { LinearIssueNeighbor, LinearIssueRelations } from "@otomat/domain";
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
} from "@tanstack/react-router";
import { useLinearRelations } from "@web/api/linear/queries";
import { hostKeys } from "@web/api/query-keys";
import { IssueChildren } from "@web/components/issues/relations/children";
import { IssueParent } from "@web/components/issues/relations/parent";
import { IssueRelationsSection } from "@web/components/issues/relations/section";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { findLabelled } from "#support/dom-queries";
import { issueContract } from "#support/issue";
import { mountWithQuery, type Mounted } from "#support/mount";
import { testQueryClient } from "#support/query";

const readRelations = vi.fn();
vi.mock("@web/api/client", () => ({
  daemon: {
    getIssue: (id: string) => Promise.resolve(issueContract({ id })),
    getLinearRelations: (id: string) => readRelations(id),
  },
}));

const neighbor: LinearIssueNeighbor = {
  external_id: "parent-external",
  identifier: "DEMO-1",
  title: "Parent issue",
  issue_id: "parent",
  url: "https://linear.app/test/issue/DEMO-1",
  state: { id: "state", name: "In progress", type: "started", color: "#aaa" },
  priority: 2,
  assignee: { id: "user", name: "Alex" },
};
const relations: LinearIssueRelations = {
  parent: neighbor,
  children: [
    { ...neighbor, external_id: "child-external", issue_id: "child", title: "Child issue" },
  ],
  relations: [
    {
      id: "block",
      type: "blocked_by",
      issue: { ...neighbor, external_id: "outside", issue_id: null, title: "External blocker" },
    },
  ],
  checked_at: "2026-09-26T00:00:00.000Z",
};
function Family() {
  const data = useLinearRelations("issue").data;
  return (
    <>
      <IssueParent parent={data?.parent ?? null} />
      <IssueChildren issues={data?.children ?? []} />
      <IssueRelationsSection issueId="issue" identifier="DEMO-2" />
    </>
  );
}

let mounted: Mounted | undefined;
afterEach(async () => {
  await mounted?.cleanup();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

it("opens local neighbors directly and leaves non-imported neighbors on Linear", async () => {
  readRelations.mockResolvedValue(relations);
  const root = createRootRoute();
  const route = createRoute({
    getParentRoute: () => root,
    path: "/issues/$issueId",
    component: Family,
  });
  const router = createRouter({
    routeTree: root.addChildren([route]),
    history: createMemoryHistory({ initialEntries: ["/issues/issue"] }),
  });
  mounted = await mountWithQuery(<RouterProvider router={router} />);
  await vi.waitFor(() => expect(mounted?.container.textContent).toContain("External blocker"));
  expect(mounted.container.querySelector('a[href="/issues/child"]')).not.toBeNull();
  expect(mounted.container.querySelector('a[target="_blank"]')?.getAttribute("href")).toBe(
    neighbor.url,
  );
  const link = mounted.container.querySelector<HTMLAnchorElement>('a[href="/issues/parent"]');
  expect(link).not.toBeNull();
  await act(async () => link?.click());
  await vi.waitFor(() => expect(router.state.location.pathname).toBe("/issues/parent"));
});

it("keeps known relations visible with a stale notice after a failed refresh", async () => {
  const client = testQueryClient();
  client.setQueryData(hostKeys("local").linearRelations("issue"), relations);
  readRelations.mockRejectedValue(new Error("Offline"));
  mounted = await mountWithQuery(
    <IssueRelationsSection issueId="issue" identifier="DEMO-2" />,
    client,
  );
  expect(mounted.container.textContent).toContain("External blocker");
  expect(mounted.container.textContent).toContain("Couldn’t refresh");
});

it.each([
  ["blocks", "Blocked by DEMO-2"],
  ["blocked_by", "Blocks DEMO-2"],
  ["related", "Related to DEMO-2"],
] as const)(
  "describes %s from the hovered neighbor’s perspective on keyboard focus",
  async (type, description) => {
    readRelations.mockResolvedValue({
      ...relations,
      relations: [{ id: "relation", type, issue: { ...neighbor, issue_id: null } }],
    });
    mounted = await mountWithQuery(<IssueRelationsSection issueId="issue" identifier="DEMO-2" />);
    const link = mounted.container.querySelector<HTMLAnchorElement>('a[target="_blank"]');
    expect(link).not.toBeNull();
    if (link === null) throw new Error("Neighbor link missing");
    const matches = link.matches.bind(link);
    vi.spyOn(link, "matches").mockImplementation(
      (selector) => selector === ":focus-visible" || matches(selector),
    );
    await act(async () => link?.focus());
    await vi.waitFor(() =>
      expect(document.querySelector('[role="tooltip"]')?.textContent).toContain(description),
    );
    const tooltip = document.querySelector('[role="tooltip"]');
    expect(tooltip?.textContent).toContain("In progress");
    expect(tooltip?.textContent).toContain("Alex");
    expect(tooltip?.textContent).toContain("High");
  },
);

it("replaces removed relations only after a successful refresh", async () => {
  readRelations.mockResolvedValue(relations);
  mounted = await mountWithQuery(<IssueRelationsSection issueId="issue" identifier="DEMO-2" />);
  expect(mounted.container.textContent).toContain("External blocker");
  readRelations.mockResolvedValue({ ...relations, relations: [] });
  await act(async () => findLabelled("Refresh relations")?.click());
  await vi.waitFor(() =>
    expect(mounted?.container.textContent).toContain("No blocking or related issues."),
  );
  expect(mounted.container.textContent).not.toContain("External blocker");
});
