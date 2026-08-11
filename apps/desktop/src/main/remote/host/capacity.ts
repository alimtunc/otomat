import {
  agentCapacitySchema,
  type ExecutionHostCapacityResult,
  type ExecutionHostId,
} from "@otomat/domain";

const CAPACITY_PATH = "/api/settings/capacity";

export interface HostCapacityActionsOptions {
  /** Where that host's daemon answers, or why it cannot be reached; asking warms an idle remote host. */
  daemonUrl(hostId: ExecutionHostId): { url: string } | { message: string };
  log(message: string): void;
  fetchImpl?: typeof fetch;
}

/** This app stores nothing: an unreachable host or a refused write comes back as a message, never as a value. */
export class HostCapacityActions {
  constructor(private readonly options: HostCapacityActionsOptions) {}

  read(hostId: ExecutionHostId): Promise<ExecutionHostCapacityResult> {
    return this.request(hostId, undefined);
  }

  write(
    hostId: ExecutionHostId,
    maxConcurrentSessions: number,
  ): Promise<ExecutionHostCapacityResult> {
    return this.request(hostId, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ max_concurrent_sessions: maxConcurrentSessions }),
    });
  }

  private async request(
    hostId: ExecutionHostId,
    init: RequestInit | undefined,
  ): Promise<ExecutionHostCapacityResult> {
    const target = this.options.daemonUrl(hostId);
    if ("message" in target) return { ok: false, message: target.message };
    const fetchImpl = this.options.fetchImpl ?? fetch;
    try {
      const response = await fetchImpl(`${target.url}${CAPACITY_PATH}`, init);
      if (!response.ok) {
        return {
          ok: false,
          message: `The ${hostId} daemon refused the capacity change (HTTP ${response.status}).`,
        };
      }
      const parsed = agentCapacitySchema.safeParse(await response.json());
      if (!parsed.success) {
        return { ok: false, message: `The ${hostId} daemon answered in an unknown format.` };
      }
      return { ok: true, capacity: parsed.data };
    } catch (error) {
      this.options.log(`Capacity request to ${hostId} failed: ${String(error)}`);
      return { ok: false, message: `Could not reach the ${hostId} daemon: ${String(error)}` };
    }
  }
}
