import { createHash, timingSafeEqual } from "node:crypto";

import { DAEMON_TOKEN_QUERY } from "@otomat/domain";
import type { MiddlewareHandler } from "hono";

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const PUBLIC_PATH = "/api/health";

/** Extra origins allowed to call the daemon cross-origin, from `OTOMAT_ALLOWED_ORIGINS` (comma-separated). */
function configuredOrigins(env: NodeJS.ProcessEnv): string[] {
  return (env.OTOMAT_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function hostname(hostHeader: string): string {
  const withoutPort = hostHeader.startsWith("[")
    ? hostHeader.slice(0, hostHeader.indexOf("]") + 1)
    : (hostHeader.split(":")[0] ?? "");
  return withoutPort.toLowerCase();
}

function isLoopbackHost(hostHeader: string | undefined): boolean {
  if (hostHeader === undefined || hostHeader === "") return false;
  return LOOPBACK_HOSTNAMES.has(hostname(hostHeader));
}

function isLoopbackOrigin(origin: string): boolean {
  const url = parseUrl(origin);
  return url !== null && LOOPBACK_HOSTNAMES.has(url.hostname.toLowerCase());
}

/** CORS `origin` resolver: echoes back only loopback origins and the configured allowlist, else denies. */
export function allowedOrigin(
  env: NodeJS.ProcessEnv = process.env,
): (origin: string) => string | null {
  const extra = new Set(configuredOrigins(env));
  return (origin) => {
    if (origin === "") return null;
    if (isLoopbackOrigin(origin) || extra.has(origin)) return origin;
    return null;
  };
}

/** Loopback bind alone does not stop DNS rebinding — the browser still sends the attacker `Host` — so reject non-loopback Hosts. */
export function hostGuard(env: NodeJS.ProcessEnv = process.env): MiddlewareHandler {
  const extraHosts = new Set(
    configuredOrigins(env)
      .map((origin) => parseUrl(origin)?.host.toLowerCase())
      .filter((host): host is string => host !== undefined && host.length > 0),
  );
  return async (c, next) => {
    const host = c.req.header("Host");
    if (isLoopbackHost(host) || (host !== undefined && extraHosts.has(host.toLowerCase()))) {
      return next();
    }
    return c.json({ error: "forbidden_host" }, 403);
  };
}

/** CORS only hides the answer: a cross-site simple request would still execute, so a foreign `Origin` never mutates. */
export function refuseForeignMutations(
  allowed: (origin: string) => string | null,
): MiddlewareHandler {
  return async (c, next) => {
    const origin = c.req.header("Origin");
    if (SAFE_METHODS.has(c.req.method) || origin === undefined || allowed(origin) !== null) {
      return next();
    }
    return c.json({ error: "forbidden_origin" }, 403);
  };
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function presentedToken(authorization: string | undefined): string | undefined {
  return /^Bearer (.+)$/i.exec(authorization ?? "")?.[1];
}

export function requireDaemonToken(token: string): MiddlewareHandler {
  const expected = digest(token);
  return async (c, next) => {
    if (c.req.path === PUBLIC_PATH) return next();
    const presented =
      presentedToken(c.req.header("Authorization")) ??
      (c.req.method === "GET" ? c.req.query(DAEMON_TOKEN_QUERY) : undefined);
    if (presented !== undefined && timingSafeEqual(digest(presented), expected)) return next();
    return c.json({ error: "unauthorized" }, 401);
  };
}
