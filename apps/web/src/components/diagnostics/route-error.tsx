import { useRouter } from "@tanstack/react-router";

import { ErrorReport } from "./error-report";
import { useComponentStack } from "./use-component-stack";

export interface RouteErrorReportProps {
  error: unknown;
  reset: () => void;
}

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
