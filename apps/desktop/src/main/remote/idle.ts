import { isRunBusy } from "@otomat/domain";

export interface RemoteIdleOptions {
  /** Origin of the remote daemon through the tunnel. */
  baseUrl: string;
  fetchImpl: typeof fetch;
  log(message: string): void;
}

/**
 * Whether the remote daemon currently has no run in flight. Every caller uses the answer to decide
 * whether it may stop that daemon, so an absent answer — unreachable host, refusal, unreadable
 * body — is never idle: when in doubt, leave the daemon alone.
 *
 * Deliberately not `@otomat/client`: the peer is a possibly stale build whose run rows may not
 * match this app's contracts, and a strict parse would leave such a daemon unjudgeable forever.
 */
export async function remoteIsIdle(options: RemoteIdleOptions): Promise<boolean> {
  try {
    const response = await options.fetchImpl(`${options.baseUrl}/api/runs`);
    if (!response.ok) return false;
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return false;
    return !payload.some(
      (run) =>
        typeof run === "object" &&
        run !== null &&
        "status" in run &&
        typeof run.status === "string" &&
        isRunBusy(run.status),
    );
  } catch (error) {
    options.log(`Remote idle check failed: ${String(error)}`);
    return false;
  }
}
