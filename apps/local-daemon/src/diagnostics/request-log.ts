import { randomUUID } from "node:crypto";

import { CORRELATION_ID_HEADER } from "@otomat/domain";
import type { Context, MiddlewareHandler } from "hono";

import type { DiagnosticLogRing } from "./log-ring.js";

const MAX_BODY_CHARACTERS = 500;

// Keyed by the request Hono is handling, so `onError` can name the same call the middleware
// stamped without threading a typed variable through every mounted route group.
const correlationByRequest = new WeakMap<Request, string>();

function nextCorrelationId(): string {
  return `req_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.stack ?? `${error.name}: ${error.message}`;
  return `Non-error value thrown: ${String(error)}`;
}

async function failureBody(response: Response): Promise<string> {
  if (!(response.headers.get("content-type") ?? "").includes("application/json")) return "";
  const body = await response.clone().text();
  return body.slice(0, MAX_BODY_CHARACTERS);
}

/**
 * Stamps every `/api` response with a correlation id and keeps a redacted line for the ones that
 * failed. That is what lets the cockpit ask this host — local or remote — what it saw for exactly
 * the request the operator is looking at, instead of showing an unrelated tail.
 */
export function correlatedRequestLog(ring: DiagnosticLogRing): MiddlewareHandler {
  return async (c, next) => {
    const correlationId = nextCorrelationId();
    correlationByRequest.set(c.req.raw, correlationId);
    c.header(CORRELATION_ID_HEADER, correlationId);
    await next();
    if (c.res.status < 400) return;
    const route = `${c.req.method} ${new URL(c.req.url).pathname}`;
    const body = await failureBody(c.res);
    ring.record(correlationId, `${route} responded ${c.res.status} ${body}`);
  };
}

/** Records the exception behind a 500 so the excerpt carries the daemon stack, not only the status. */
export function recordThrownFailure(ring: DiagnosticLogRing, c: Context, error: unknown): void {
  ring.record(correlationByRequest.get(c.req.raw) ?? null, describeError(error));
}
