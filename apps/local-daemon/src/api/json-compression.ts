import type { MiddlewareHandler } from "hono";
import { compress } from "hono/compress";

const JSON_CONTENT_TYPE = /^application\/json(?:[;\s]|$)/i;

/** Hono skips its size threshold for a body without `Content-Length`, which no `c.json` response carries. */
const measureJson: MiddlewareHandler = async (c, next) => {
  await next();
  if (!JSON_CONTENT_TYPE.test(c.res.headers.get("Content-Type") ?? "")) return;
  const body = await c.res.arrayBuffer();
  c.res = new Response(body, c.res);
  c.res.headers.set("Content-Length", String(body.byteLength));
};

/** JSON only: an event stream must reach the client unbuffered, and media carries its own encoding. */
export const jsonCompression: MiddlewareHandler[] = [
  compress({ threshold: 1024, contentTypeFilter: JSON_CONTENT_TYPE }),
  measureJson,
];
