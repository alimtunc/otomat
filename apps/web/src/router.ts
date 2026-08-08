import { createRouter } from "@tanstack/react-router";
import { RouteErrorReport } from "@web/components/diagnostics/route-error";
import { recordComponentStack } from "@web/lib/diagnostics/component-stacks";

import { routeTree } from "./routeTree.gen";

export const router = createRouter({
  routeTree,
  defaultErrorComponent: RouteErrorReport,
  // The router's boundary hands the error component only `error` and `reset`; this is the one
  // place React's component stack is offered, and the report is useless without it.
  defaultOnCatch: (error, info) => recordComponentStack(error, info.componentStack ?? null),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
