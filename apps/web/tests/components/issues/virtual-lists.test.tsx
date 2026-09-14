// @vitest-environment happy-dom

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { IssuesBoard } from "@web/components/issues/list/board";
import { IssuesTable } from "@web/components/issues/list/table";
import { focusRange } from "@web/components/virtual-list/focus-range";
import { groupIssues } from "@web/lib/issue/grouping";
import { act } from "react";
import { expect, it, vi } from "vitest";

import { issueContract } from "#support/issue";
import { mockListViewport } from "#support/list-viewport";
import { mount } from "#support/mount";
import { mountRouted } from "#support/router";

mockListViewport();

it.each([IssuesTable, IssuesBoard])(
  "bounds a large list and reaches its last issue using the keyboard",
  async (Component) => {
    const groups = groupIssues(
      Array.from({ length: 4300 }, (_, index) =>
        issueContract({ id: `i-${index}`, title: `Issue ${index}` }),
      ),
      "none",
      new Map(),
    );
    const view = await mountRouted(
      <Component
        groups={groups}
        showGroupHeadings={false}
        collapsed={[]}
        onToggleGroup={vi.fn()}
      />,
    );
    try {
      const links = view.container.querySelectorAll<HTMLAnchorElement>('a[href^="/issues/"]');
      expect(links.length).toBeGreaterThan(0);
      expect(links.length).toBeLessThan(50);
      const first = links[0];
      await act(async () => {
        first.focus();
        first.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
      });
      expect(document.activeElement?.textContent).toContain("Issue 4299");
      expect(view.container.querySelectorAll('a[href^="/issues/"]').length).toBeLessThan(55);
    } finally {
      await view.cleanup();
    }
  },
);

it("retains the focused row and its tab neighbours outside the scrolled range", () => {
  const indices = focusRange({ startIndex: 100, endIndex: 110, overscan: 2, count: 4300 }, 5);
  expect(indices).toEqual([4, 5, 6, ...Array.from({ length: 15 }, (_, index) => index + 98)]);
});

it("restores measured rows with the router's URL key and a scope containing quotes", async () => {
  const groups = groupIssues(
    Array.from({ length: 4300 }, (_, index) =>
      issueContract({ id: `restored-${index}`, title: `Restored ${index}` }),
    ),
    "none",
    new Map(),
  );
  const root = createRootRoute({ component: Outlet });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
    scrollRestoration: true,
    getScrollRestorationKey: (location) => location.href,
    routeTree: root.addChildren([
      createRoute({
        getParentRoute: () => root,
        path: "/",
        component: () => (
          <IssuesTable
            groups={groups}
            showGroupHeadings={false}
            collapsed={[]}
            onToggleGroup={vi.fn()}
            scrollId={'issues:local:{"project":"p1"}'}
          />
        ),
      }),
      createRoute({ getParentRoute: () => root, path: "/away", component: () => null }),
    ]),
  });
  const view = await mount(<RouterProvider router={router} />);
  try {
    await act(async () => {
      await router.load();
    });
    const scroller = view.container.querySelector<HTMLElement>("[data-virtual-list]");
    expect(scroller).not.toBeNull();
    await act(async () => {
      scroller!.scrollTop = 100_000;
      scroller!.dispatchEvent(new Event("scroll"));
    });
    await act(async () => {
      await router.navigate({ to: "/away" });
    });
    await act(async () => {
      await router.navigate({ to: "/" });
    });
    expect(view.container.querySelector<HTMLElement>("[data-virtual-list]")?.scrollTop).toBe(
      100_000,
    );
    expect(view.container.querySelector('a[href="/issues/restored-2500"]')).not.toBeNull();
    expect(view.container.querySelectorAll('a[href^="/issues/"]').length).toBeLessThan(50);
  } finally {
    await view.cleanup();
  }
});
