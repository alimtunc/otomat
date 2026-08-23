import type { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act, createElement, type ReactNode } from "react";

import { mount, mountWithQuery, type Mounted } from "#support/mount";

function routedElement(node: ReactNode): ReactNode {
  const rootRoute = createRootRoute({ component: Outlet });
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: "/", component: () => node }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/issues/$issueId",
      component: () => null,
    }),
    createRoute({ getParentRoute: () => rootRoute, path: "/runs/$runId", component: () => null }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/runs/$runId/pr",
      component: () => null,
    }),
  ]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return createElement(RouterProvider, { router });
}

/** The router resolves its first match asynchronously; flush before asserting on the DOM. */
async function flushRouter(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

export async function mountRouted(node: ReactNode): Promise<Mounted> {
  const mounted = await mount(routedElement(node));
  await flushRouter();
  return mounted;
}

export async function mountRoutedWithQuery(
  node: ReactNode,
  client?: QueryClient,
): Promise<Mounted> {
  const mounted = await mountWithQuery(routedElement(node), client);
  await flushRouter();
  return mounted;
}
