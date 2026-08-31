import { createDaemonClient, DaemonRequestError, DaemonTransportError } from "@otomat/client";
import type { AgentProfileReplicaEntry } from "@otomat/domain";

import type { HostTarget } from "./catalog.js";

/** A host switch awaits a round, so a tunnel that is up while its daemon is wedged must not hold it. */
const REQUEST_TIMEOUT_MS = 5_000;

export interface AgentProfileSyncOptions {
  targets(): HostTarget[];
  fetchImpl: typeof fetch;
  log(message: string): void;
}

export class AgentProfileSync {
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly options: AgentProfileSyncOptions) {}

  /** Rounds run one at a time: two overlapping ones would each merge against a catalog the other is rewriting. */
  sync(): Promise<void> {
    this.tail = this.tail
      .then(
        () => this.syncNow(),
        () => undefined,
      )
      .catch((error: unknown) => this.options.log(`Agent profile sync failed: ${String(error)}`));
    return this.tail;
  }

  private async syncNow(): Promise<void> {
    const urls = this.options
      .targets()
      .map((target) => target.url)
      .filter((url) => url !== null);
    if (urls.length < 2) return;
    let replica: AgentProfileReplicaEntry[] = [];
    const visited: string[] = [];
    for (const url of urls) {
      const merged = await this.merge(url, replica);
      if (merged === null) continue;
      replica = merged;
      visited.push(url);
    }
    for (const url of visited.slice(0, -1)) await this.merge(url, replica);
  }

  /** Unreachable or refusing reads null, never a throw: one dead host must not stop the others converging. */
  private async merge(
    baseUrl: string,
    profiles: readonly AgentProfileReplicaEntry[],
  ): Promise<AgentProfileReplicaEntry[] | null> {
    try {
      return await createDaemonClient({
        baseUrl,
        fetch: (input, init) =>
          this.options.fetchImpl(input, {
            ...init,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          }),
      }).mergeAgentProfileReplica(profiles);
    } catch (error) {
      if (error instanceof DaemonRequestError) {
        this.options.log(`Agent profile sync refused by ${baseUrl} (HTTP ${error.status})`);
        return null;
      }
      if (error instanceof DaemonTransportError) {
        this.options.log(`Could not reach ${baseUrl} for agent profiles: ${String(error.cause)}`);
        return null;
      }
      this.options.log(`Host at ${baseUrl} returned an invalid agent profile replica`);
      return null;
    }
  }
}
