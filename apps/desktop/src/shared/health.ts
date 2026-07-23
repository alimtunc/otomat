import { healthResponseSchema } from "@otomat/domain";

import { HEALTH_INTERVAL_MS, HEALTH_TIMEOUT_MS } from "#shared/constants";

import { withAbortTimeout } from "./abort-timeout.js";

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
      const remainingMs = Math.max(1, deadline - now());
      const status = await withAbortTimeout(remainingMs, options.signal, async (signal) => {
        const response = await doFetch(options.url, { signal });
        if (!response.ok) return response.status;
        healthResponseSchema.parse(await response.json());
        return null;
      });
      if (status === null) return;
      lastError = new Error(`health responded ${status}`);
    } catch (error) {
      if (options.signal?.aborted === true) {
        throw new Error("daemon exited before it became healthy", { cause: error });
      }
      lastError = error;
    }
    await sleep(intervalMs);
  }
  throw new Error(`daemon health check timed out after ${timeoutMs}ms`, { cause: lastError });
}
