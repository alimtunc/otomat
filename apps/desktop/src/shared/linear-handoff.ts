import { linearConnectionContractSchema, type LinearConnectionContract } from "@otomat/domain";

export interface LinearHandoffOptions {
  daemonUrl: string;
  apiKey: string;
  fetch?: typeof fetch;
}

/**
 * Hands the key to the daemon over loopback once it is healthy. This is the only
 * transfer path: the key is never placed in the daemon's environment, because the
 * daemon re-spreads `process.env` into every supervised agent worker.
 *
 * The daemon's own host guard accepts this request (a loopback `Host`, no
 * `Origin`), so no CORS or CSP allowance is involved.
 */
export async function pushLinearKey(
  options: LinearHandoffOptions,
): Promise<LinearConnectionContract> {
  const fetchImpl = options.fetch ?? fetch;
  const response = await fetchImpl(`${options.daemonUrl}/api/linear/connect`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: options.apiKey }),
  });
  if (!response.ok) throw new Error(`daemon refused the Linear key (${response.status})`);
  return linearConnectionContractSchema.parse(await response.json());
}

export async function clearLinearKey(
  daemonUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchImpl(`${daemonUrl}/api/linear/disconnect`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  if (!response.ok) throw new Error(`daemon refused the Linear disconnect (${response.status})`);
}
