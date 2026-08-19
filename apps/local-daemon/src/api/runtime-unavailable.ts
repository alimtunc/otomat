import type { Context, Env } from "hono";

import { RuntimeUnavailableError } from "#runtime";

export function runtimeUnavailableResponse<E extends Env>(
  c: Context<E>,
  error: unknown,
): Response | null {
  if (!(error instanceof RuntimeUnavailableError)) return null;
  return c.json(
    {
      error: "runtime_unavailable",
      runtime: error.runtime,
      reason: error.reason,
      message: error.message,
    },
    409,
  );
}
