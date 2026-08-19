import { CORRELATION_ID_HEADER } from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * Thrown by HTTP helpers on a non-2xx response; `body` carries the daemon's JSON
 * error payload when one was provided, and `correlationId` the id that daemon stamped
 * on the response, which is what its diagnostics excerpt is keyed by.
 */
export class DaemonRequestError extends Error {
  readonly status: number;
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
  readonly correlationId: string | null;

  constructor(
    status: number,
    method: string,
    path: string,
    body: unknown = null,
    correlationId: string | null = null,
  ) {
    super(`Daemon request to ${path} failed with status ${status}`);
    this.name = "DaemonRequestError";
    this.status = status;
    this.method = method;
    this.path = path;
    this.body = body;
    this.correlationId = correlationId;
  }
}

/**
 * Thrown when the request never reached a daemon at all — the host is down, the SSH tunnel is
 * closed, or the origin is wrong. It is a distinct class because no daemon log can explain it.
 */
export class DaemonTransportError extends Error {
  readonly method: string;
  readonly path: string;

  constructor(method: string, path: string, cause: unknown) {
    super(`Daemon request to ${path} could not reach the host`, { cause });
    this.name = "DaemonTransportError";
    this.method = method;
    this.path = path;
  }
}

async function readErrorBody(res: Response): Promise<JsonValue> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export function resolveUrl(config: DaemonClientConfig, path: string): string {
  return `${config.baseUrl ?? ""}${path}`;
}

export function queryString(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  );
  if (entries.length === 0) return "";
  return `?${new URLSearchParams(entries).toString()}`;
}

async function daemonFetch(
  config: DaemonClientConfig,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const doFetch = config.fetch ?? fetch;
  const method = init?.method ?? "GET";
  let res: Response;
  try {
    res = await doFetch(resolveUrl(config, path), init);
  } catch (error) {
    throw new DaemonTransportError(method, path, error);
  }
  if (!res.ok) {
    throw new DaemonRequestError(
      res.status,
      method,
      path,
      await readErrorBody(res),
      res.headers.get(CORRELATION_ID_HEADER),
    );
  }
  return res;
}

export async function getJson(config: DaemonClientConfig, path: string): Promise<JsonValue> {
  return (await daemonFetch(config, path)).json();
}

export async function postJson(
  config: DaemonClientConfig,
  path: string,
  body: unknown,
): Promise<JsonValue> {
  return sendJson(config, "POST", path, body);
}

export async function patchJson(
  config: DaemonClientConfig,
  path: string,
  body: unknown,
): Promise<JsonValue> {
  return sendJson(config, "PATCH", path, body);
}

export async function putJson(
  config: DaemonClientConfig,
  path: string,
  body: unknown,
): Promise<JsonValue> {
  return sendJson(config, "PUT", path, body);
}

async function sendJson(
  config: DaemonClientConfig,
  method: "POST" | "PATCH" | "PUT",
  path: string,
  body: unknown,
): Promise<JsonValue> {
  const res = await daemonFetch(config, path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function deleteJson(config: DaemonClientConfig, path: string): Promise<void> {
  await daemonFetch(config, path, { method: "DELETE" });
}
