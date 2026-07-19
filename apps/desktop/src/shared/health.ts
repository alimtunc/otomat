import { healthResponseSchema } from "@otomat/domain";

import { HEALTH_INTERVAL_MS, HEALTH_TIMEOUT_MS } from "#shared/constants";

export interface WaitForHealthOptions {
  /** Full health URL, e.g. `http://127.0.0.1:PORT/api/health`. */
  url: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  intervalMs?: number;
  /** Aborts the wait early (e.g. the daemon process died before it ever answered). */
  signal?: AbortSignal;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Polls `/api/health` until it answers 200 with a body matching the domain contract, or the
 * timeout elapses / the signal aborts. Resolves on the first healthy response; rejects with the
 * last transport/status error as `cause` so startup can show an honest, safe detail.
 */
export async function waitForHealth(options: WaitForHealthOptions): Promise<void> {
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? HEALTH_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? HEALTH_INTERVAL_MS;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const deadline = now() + timeoutMs;

  let lastError: unknown = new Error("health never answered");
  while (now() < deadline) {
    if (options.signal?.aborted) throw new Error("daemon exited before it became healthy");
    try {
      const res = await doFetch(options.url, options.signal ? { signal: options.signal } : {});
      if (res.ok) {
        healthResponseSchema.parse(await res.json());
        return;
      }
      lastError = new Error(`health responded ${res.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(intervalMs);
  }
  throw new Error(`daemon health check timed out after ${timeoutMs}ms`, { cause: lastError });
}
