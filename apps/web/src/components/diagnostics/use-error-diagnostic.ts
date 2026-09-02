import type { ErrorDiagnostic } from "@otomat/domain";
import { skipToken, useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useHealth } from "@web/api/daemon/queries";
import { useQueryKeys } from "@web/api/use-query-keys";
import { buildErrorDiagnostic } from "@web/lib/diagnostics/build";
import { classifyError } from "@web/lib/diagnostics/classify";
import { useState } from "react";

export interface ErrorDiagnosticOptions {
  error: unknown;
  componentStack?: string | null;
  occurredAt?: Date;
}

export interface ErrorDiagnosticState {
  diagnostic: ErrorDiagnostic;
  logPending: boolean;
  logError: Error | null;
}

export function useErrorDiagnostic(options: ErrorDiagnosticOptions): ErrorDiagnosticState {
  const keys = useQueryKeys();
  const [renderedAt] = useState(() => new Date());
  const classification = classifyError(options.error);
  const request = classification.request;
  const correlationId =
    classification.category === "daemon" && request !== null ? request.correlation_id : null;
  const health = useHealth();
  const excerpt = useQuery({
    queryKey: keys.daemonLogExcerpt(correlationId),
    queryFn: correlationId === null ? skipToken : () => daemon.daemonLogExcerpt(correlationId),
    staleTime: Infinity,
    retry: false,
  });
  const daemonIdentity =
    health.data === undefined ? null : { version: health.data.version, build: health.data.build };
  return {
    diagnostic: buildErrorDiagnostic({
      classification,
      route: window.location.pathname,
      componentStack: options.componentStack ?? null,
      daemon: daemonIdentity,
      daemonLog: excerpt.data === undefined ? null : excerpt.data.entries,
      occurredAt: options.occurredAt ?? renderedAt,
    }),
    logPending: correlationId !== null && excerpt.isPending,
    logError: excerpt.error,
  };
}
