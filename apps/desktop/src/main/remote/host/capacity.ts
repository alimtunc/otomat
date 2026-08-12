import {
  createDaemonClient,
  DaemonRequestError,
  DaemonTransportError,
  type DaemonClient,
} from "@otomat/client";
import type { AgentCapacity, ExecutionHostCapacityResult, ExecutionHostId } from "@otomat/domain";

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
    return this.request(hostId, (client) => client.agentCapacity());
  }

  write(
    hostId: ExecutionHostId,
    maxConcurrentSessions: number,
  ): Promise<ExecutionHostCapacityResult> {
    return this.request(hostId, (client) =>
      client.setAgentCapacity({ max_concurrent_sessions: maxConcurrentSessions }),
    );
  }

  private async request(
    hostId: ExecutionHostId,
    call: (client: DaemonClient) => Promise<AgentCapacity>,
  ): Promise<ExecutionHostCapacityResult> {
    const target = this.options.daemonUrl(hostId);
    if ("message" in target) return { ok: false, message: target.message };
    const client = createDaemonClient({
      baseUrl: target.url,
      ...(this.options.fetchImpl === undefined ? {} : { fetch: this.options.fetchImpl }),
    });
    try {
      return { ok: true, capacity: await call(client) };
    } catch (error) {
      if (error instanceof DaemonRequestError) {
        return {
          ok: false,
          message: `The ${hostId} daemon refused the capacity change (HTTP ${error.status}).`,
        };
      }
      if (error instanceof DaemonTransportError) {
        this.options.log(`Capacity request to ${hostId} failed: ${String(error.cause)}`);
        return {
          ok: false,
          message: `Could not reach the ${hostId} daemon: ${String(error.cause)}`,
        };
      }
      return { ok: false, message: `The ${hostId} daemon answered in an unknown format.` };
    }
  }
}
