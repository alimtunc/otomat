import { DaemonRequestError, type DaemonClientConfig } from "./types";

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

export async function getJson(config: DaemonClientConfig, path: string): Promise<unknown> {
  const doFetch = config.fetch ?? fetch;
  const res = await doFetch(resolveUrl(config, path));
  if (!res.ok) throw new DaemonRequestError(res.status, path);
  return res.json();
}

export async function postJson(
  config: DaemonClientConfig,
  path: string,
  body: unknown,
): Promise<unknown> {
  const doFetch = config.fetch ?? fetch;
  const res = await doFetch(resolveUrl(config, path), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new DaemonRequestError(res.status, path);
  return res.json();
}
