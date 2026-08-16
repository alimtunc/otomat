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
