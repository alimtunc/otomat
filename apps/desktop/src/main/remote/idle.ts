import { isRunBusy } from "@otomat/domain";

export interface RemoteIdleOptions {
  /** Origin of the remote daemon through the tunnel. */
  baseUrl: string;
  fetchImpl: typeof fetch;
  log(message: string): void;
}

/**
 * How many runs are in flight on the remote daemon, or null when it could not say — unreachable
 * host, refusal, unreadable body. Every caller uses the answer to decide whether it may stop that
 * daemon, and null is never read as zero: when in doubt, leave the daemon alone.
 *
 * Deliberately not `@otomat/client`: the peer is a possibly stale build whose run rows may not
 * match this app's contracts, and a strict parse would leave such a daemon unjudgeable forever.
 */
export async function remoteBusyRuns(options: RemoteIdleOptions): Promise<number | null> {
  try {
    const response = await options.fetchImpl(`${options.baseUrl}/api/runs`);
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return null;
    return payload.filter(
      (run) =>
        typeof run === "object" &&
        run !== null &&
        "status" in run &&
        typeof run.status === "string" &&
        isRunBusy(run.status),
    ).length;
  } catch (error) {
    options.log(`Remote idle check failed: ${String(error)}`);
    return null;
  }
}
