// @vitest-environment happy-dom
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { useBackNavigation } from "@web/components/shell/use-back-navigation";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { mount } from "#support/mount";

let linkedIssueId: string | null = null;

function BackProbe() {
  const back = useBackNavigation(linkedIssueId);
  if (back === null) return <span data-testid="no-back" />;
  return <button type="button" data-testid="back" aria-label={back.label} onClick={back.goBack} />;
}

/** Mirrors the app's detail routes; the views themselves are covered by their own suites. */
function testRouter(entry: string) {
  const rootRoute = createRootRoute({ component: Outlet });
  const issuesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/issues",
    validateSearch: (search: Record<string, unknown>): { filter?: string } => ({
      filter: typeof search.filter === "string" ? search.filter : undefined,
    }),
    component: BackProbe,
  });
  const issueRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/issues/$issueId",
    component: BackProbe,
  });
  const runsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/runs",
    component: BackProbe,
  });
  const runRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/runs/$runId",
    component: BackProbe,
  });
  const runDiffRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/runs/$runId/diff",
    component: BackProbe,
  });

  return createRouter({
    routeTree: rootRoute.addChildren([issuesRoute, issueRoute, runsRoute, runRoute, runDiffRoute]),
    history: createMemoryHistory({ initialEntries: [entry] }),
  });
}

type TestRouter = ReturnType<typeof testRouter>;

const mounted: Array<() => Promise<void>> = [];

// A history notification reaches the DOM through the router's own async load; flush both.
async function settle() {
  for (let tick = 0; tick < 2; tick++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function openAt(entry: string) {
  const router = testRouter(entry);
  const { container, cleanup } = await mount(<RouterProvider router={router} />);
  mounted.push(cleanup);
  await settle();
  return { router, container };
}

const backButtonOf = (container: HTMLElement) =>
  container.querySelector<HTMLButtonElement>('[data-testid="back"]');

async function goTo(router: TestRouter, href: string) {
  await act(async () => {
    router.history.push(href);
  });
  await settle();
}

async function clickBack(container: HTMLElement) {
  const button = backButtonOf(container);
  if (button === null) throw new Error("no back control rendered");
  await act(async () => {
    button.click();
  });
  await settle();
}

beforeEach(() => {
  linkedIssueId = null;
});

afterEach(async () => {
  for (const cleanup of mounted.splice(0)) await cleanup();
});

describe("back navigation", () => {
  it("returns to the list a detail was opened from", async () => {
    const { router, container } = await openAt("/issues");
    expect(backButtonOf(container)).toBeNull();

    await goTo(router, "/issues/issue-1");
    await clickBack(container);

    expect(router.state.location.pathname).toBe("/issues");
  });

  it("keeps the list filters the detail was opened from", async () => {
    const { router, container } = await openAt("/issues?filter=active");

    await goTo(router, "/issues/issue-1");
    await clickBack(container);

    expect(router.state.location.pathname).toBe("/issues");
    expect(router.state.location.search).toEqual({ filter: "active" });
  });

  it("walks issue → run → review back the way it came", async () => {
    const { router, container } = await openAt("/issues/issue-1");

    await goTo(router, "/runs/run-1");
    await goTo(router, "/runs/run-1/diff");

    await clickBack(container);
    expect(router.state.location.pathname).toBe("/runs/run-1");

    await clickBack(container);
    expect(router.state.location.pathname).toBe("/issues/issue-1");
  });

  it("falls back up the hierarchy from a deep-linked review, never out of the app", async () => {
    linkedIssueId = "issue-1";
    const { router, container } = await openAt("/runs/run-1/diff");

    await clickBack(container);
    expect(router.state.location.pathname).toBe("/runs/run-1");

    await clickBack(container);
    expect(router.state.location.pathname).toBe("/issues/issue-1");

    await clickBack(container);
    expect(router.state.location.pathname).toBe("/issues");
    expect(router.history.canGoBack()).toBe(false);
  });

  it("falls back to the runs list when the run has no linked issue", async () => {
    const { router, container } = await openAt("/runs/run-1");

    await clickBack(container);

    expect(router.state.location.pathname).toBe("/runs");
  });

  it("names the fallback destination, and stays generic once history exists", async () => {
    linkedIssueId = "issue-1";
    const { router, container } = await openAt("/runs/run-1");
    expect(backButtonOf(container)?.getAttribute("aria-label")).toBe("Back to issue issue-1");

    await goTo(router, "/runs/run-1/diff");

    expect(backButtonOf(container)?.getAttribute("aria-label")).toBe("Back");
  });
});
