// @vitest-environment happy-dom
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useLocation,
} from "@tanstack/react-router";
import { useDesktopOpenRun } from "@web/components/shell/use-desktop-open-run";
import { act } from "react";
import { afterEach, expect, it } from "vitest";

import { fakeDesktopBridge } from "#support/desktop-bridge";
import { mount } from "#support/mount";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  delete window.otomat;
});

/** Mounted on the root route, so it survives the navigation it is watching for. */
function OpenRunProbe() {
  useDesktopOpenRun();
  return (
    <span data-testid="pathname">
      {useLocation().pathname}
      <Outlet />
    </span>
  );
}

function cockpit() {
  const rootRoute = createRootRoute({ component: OpenRunProbe });
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: "/", component: () => null }),
    createRoute({ getParentRoute: () => rootRoute, path: "/runs/$runId", component: () => null }),
  ]);
  const router = createRouter({ routeTree, history: createMemoryHistory() });
  return <RouterProvider router={router} />;
}

function bridgeAskingForRuns() {
  let ask: ((runId: string) => void) | null = null;
  let unsubscribed = false;
  window.otomat = fakeDesktopBridge({
    onOpenRun: (listener) => {
      ask = listener;
      return () => {
        unsubscribed = true;
      };
    },
  });
  return { ask: (runId) => ask?.(runId), unsubscribed: () => unsubscribed };
}

async function mountCockpit(): Promise<() => string | null> {
  const mounted = await mount(cockpit());
  cleanups.push(mounted.cleanup);
  await act(async () => {
    await Promise.resolve();
  });
  return () => mounted.container.textContent;
}

it("opens the run the menu bar asked for", async () => {
  const bridge = bridgeAskingForRuns();
  const read = await mountCockpit();

  await act(async () => {
    bridge.ask("run-42");
    await Promise.resolve();
  });

  expect(read()).toBe("/runs/run-42");
});

it("lets the menu bar go once the shell is gone", async () => {
  const bridge = bridgeAskingForRuns();
  await mountCockpit();

  for (const cleanup of cleanups.splice(0)) await cleanup();

  expect(bridge.unsubscribed()).toBe(true);
});

it("stays where it is in a browser, where there is no desktop shell to ask", async () => {
  const read = await mountCockpit();

  expect(read()).toBe("/");
});
