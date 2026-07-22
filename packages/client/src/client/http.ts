import type { DaemonClientConfig } from "./config.js";

/**
 * Thrown by HTTP helpers on a non-2xx response; `body` carries the daemon's JSON
 * error payload when one was provided.
 */
export class DaemonRequestError extends Error {
  readonly status: number;
  readonly path: string;
  readonly body: unknown;

  constructor(status: number, path: string, body: unknown = null) {
    super(`Daemon request to ${path} failed with status ${status}`);
    this.name = "DaemonRequestError";
    this.status = status;
    this.path = path;
    this.body = body;
  }
}

async function readErrorBody(res: Response): Promise<unknown> {
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
  const res = await doFetch(resolveUrl(config, path), init);
  if (!res.ok) throw new DaemonRequestError(res.status, path, await readErrorBody(res));
  return res;
}

export async function getJson(config: DaemonClientConfig, path: string): Promise<unknown> {
  return (await daemonFetch(config, path)).json();
}

export async function postJson(
  config: DaemonClientConfig,
  path: string,
  body: unknown,
): Promise<unknown> {
  return sendJson(config, "POST", path, body);
}

export async function patchJson(
  config: DaemonClientConfig,
  path: string,
  body: unknown,
): Promise<unknown> {
  return sendJson(config, "PATCH", path, body);
}

async function sendJson(
  config: DaemonClientConfig,
  method: "POST" | "PATCH",
  path: string,
  body: unknown,
): Promise<unknown> {
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
