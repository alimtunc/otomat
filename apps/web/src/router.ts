import { createRouter } from "@tanstack/react-router";
import { RouteErrorReport } from "@web/components/diagnostics/route-error";
import { recordComponentStack } from "@web/lib/diagnostics/component-stacks";

import { routeTree } from "./routeTree.gen";

export const router = createRouter({
  routeTree,
  scrollRestoration: true,
  // A tab reopens its remembered href, so the offset is remembered by href rather than by history entry.
  getScrollRestorationKey: (location) => location.href,
  defaultErrorComponent: RouteErrorReport,
  defaultOnCatch: (error, info) => recordComponentStack(error, info.componentStack ?? null),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
