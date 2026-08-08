import { DaemonRequestError, DaemonTransportError } from "@otomat/client";
import type { ErrorDiagnosticCategory, ErrorDiagnosticRequest } from "@otomat/domain";

export interface ErrorClassification {
  category: ErrorDiagnosticCategory;
  message: string;
  stack: string | null;
  request: ErrorDiagnosticRequest | null;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : `Non-error value thrown: ${String(error)}`;
}

function stackOf(error: unknown): string | null {
  return error instanceof Error ? (error.stack ?? null) : null;
}

/**
 * Names where an incident came from before anything is shown. The distinction is the whole point:
 * a renderer exception appears in no daemon log, and a transport failure never reached a host at
 * all, so asking the operator for daemon logs would send them after evidence that cannot exist.
 */
export function classifyError(error: unknown): ErrorClassification {
  if (error instanceof DaemonRequestError) {
    return {
      category: "daemon",
      message: messageOf(error),
      stack: stackOf(error),
      request: {
        method: error.method,
        path: error.path,
        status: error.status,
        correlation_id: error.correlationId,
      },
    };
  }
  if (error instanceof DaemonTransportError) {
    return {
      category: "transport",
      message: messageOf(error),
      stack: stackOf(error),
      request: { method: error.method, path: error.path, status: null, correlation_id: null },
    };
  }
  return { category: "renderer", message: messageOf(error), stack: stackOf(error), request: null };
}
