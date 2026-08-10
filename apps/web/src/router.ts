import { createRouter } from "@tanstack/react-router";
import { RouteErrorReport } from "@web/components/diagnostics/route-error";
import { recordComponentStack } from "@web/lib/diagnostics/component-stacks";

import { routeTree } from "./routeTree.gen";

export const router = createRouter({
  routeTree,
  defaultErrorComponent: RouteErrorReport,
  defaultOnCatch: (error, info) => recordComponentStack(error, info.componentStack ?? null),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
