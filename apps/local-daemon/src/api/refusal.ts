import type { Context, Env } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

interface ApiRefusal {
  status: ContentfulStatusCode;
  error: string;
  message: string;
}

export function refusalJson<E extends Env>(c: Context<E>, refusal: ApiRefusal) {
  return c.json({ error: refusal.error, message: refusal.message }, refusal.status);
}

/** Every refused-command code names an unknown target with a `_not_found` suffix; that suffix is the whole 404 contract. */
export function commandRefusalJson<E extends Env>(
  c: Context<E>,
  error: { code: string; message: string },
) {
  return refusalJson(c, {
    status: error.code.endsWith("_not_found") ? 404 : 409,
    error: error.code,
    message: error.message,
  });
}
