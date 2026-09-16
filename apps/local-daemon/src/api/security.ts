import { timingSafeEqual } from "node:crypto";

import { DAEMON_API_TOKEN_ENV, DAEMON_HEALTH_PATH } from "@otomat/domain";
import type { MiddlewareHandler } from "hono";

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

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

/** Reads the token once and removes it, so a worker re-exec'd with this environment never carries it. */
export function takeDaemonApiToken(env: NodeJS.ProcessEnv = process.env): string | null {
  const token = env[DAEMON_API_TOKEN_ENV];
  delete env[DAEMON_API_TOKEN_ENV];
  return token === undefined || token === "" ? null : token;
}

function bearerMatches(header: string | undefined, token: string): boolean {
  const expected = Buffer.from(`Bearer ${token}`);
  const given = Buffer.from(header ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Every `/api` route but health needs the bearer; a browser cannot attach it cross-origin without a preflight, which closes CSRF as well. */
export function bearerGuard(token: string): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.path === DAEMON_HEALTH_PATH || bearerMatches(c.req.header("Authorization"), token)) {
      return next();
    }
    return c.json({ error: "unauthorized" }, 401);
  };
}
