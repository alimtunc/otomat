import { useRouter } from "@tanstack/react-router";

import { ErrorReport } from "./error-report";
import { useComponentStack } from "./use-component-stack";

export interface RouteErrorReportProps {
  error: unknown;
  reset: () => void;
}

/**
 * The router's error component. It catches route render and loader failures, which is where a
 * renderer exception like a panel-layout fault actually lands, and keeps the shell navigable:
 * `reset` clears the boundary, so retrying re-renders the route instead of reloading the app.
 */
export function RouteErrorReport({ error, reset }: RouteErrorReportProps) {
  const router = useRouter();
  const componentStack = useComponentStack(error);
  return (
    <ErrorReport
      error={error}
      componentStack={componentStack}
      onRetry={() => {
        reset();
        void router.invalidate();
      }}
      onBack={() => router.history.back()}
    />
  );
}
