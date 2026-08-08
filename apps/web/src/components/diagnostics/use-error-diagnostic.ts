import type { ErrorDiagnostic } from "@otomat/domain";
import { skipToken, useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useHealth } from "@web/api/daemon/queries";
import { queryKeys } from "@web/api/query-keys";
import { buildErrorDiagnostic } from "@web/lib/diagnostics/build";
import { classifyError } from "@web/lib/diagnostics/classify";
import { useState } from "react";

export interface ErrorDiagnosticOptions {
  error: unknown;
  /** React's component stack, when the boundary that caught this exposes one. */
  componentStack?: string | null;
  /** When the boundary caught it; defaults to when this surface first rendered. */
  occurredAt?: Date;
}

export interface ErrorDiagnosticState {
  diagnostic: ErrorDiagnostic;
  /** True while the active host is still being asked what it recorded for this request. */
  logPending: boolean;
  /** Set when the host could not answer, so the panel says that instead of implying no log. */
  logError: Error | null;
}

/**
 * Assembles the incident on screen: classification first, then — only for a daemon failure that
 * came back with a correlation id — the excerpt that host kept for exactly that request. A
 * renderer or transport failure never asks, because no host could have recorded it.
 */
export function useErrorDiagnostic(options: ErrorDiagnosticOptions): ErrorDiagnosticState {
  const [renderedAt] = useState(() => new Date());
  const classification = classifyError(options.error);
  const request = classification.request;
  const correlationId =
    classification.category === "daemon" && request !== null ? request.correlation_id : null;
  const health = useHealth();
  const excerpt = useQuery({
    queryKey: queryKeys.daemonLogExcerpt(correlationId),
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
