import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act, createElement, type ReactNode } from "react";

import { mount, type Mounted } from "#support/mount";

/** Mounts a fragment under the app's real detail paths so its <Link> targets resolve. */
export async function mountRouted(node: ReactNode): Promise<Mounted> {
  const rootRoute = createRootRoute({ component: Outlet });
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: "/", component: () => node }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/issues/$issueId",
      component: () => null,
    }),
    createRoute({ getParentRoute: () => rootRoute, path: "/runs/$runId", component: () => null }),
  ]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const mounted = await mount(createElement(RouterProvider, { router }));
  // The router resolves its first match asynchronously; flush before asserting on the DOM.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return mounted;
}
