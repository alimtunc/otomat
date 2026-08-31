import type { ExecutionHostId, LinearDeliverySnapshot } from "@otomat/domain";

import { hostDelivery, type HostDeliveryRecord } from "./delivery.js";
import type { LinearDaemonTarget } from "./targets.js";

/** What the last exchange with each host established about each connection's key. */
export class LinearDeliveryLedger {
  private readonly labels = new Map<string, string>();
  private readonly records = new Map<string, Map<ExecutionHostId, HostDeliveryRecord>>();

  set(connectionId: string, hostId: ExecutionHostId, record: HostDeliveryRecord): void {
    const hosts = this.records.get(connectionId) ?? new Map<ExecutionHostId, HostDeliveryRecord>();
    hosts.set(hostId, record);
    this.records.set(connectionId, hosts);
  }

  get(connectionId: string, hostId: ExecutionHostId): HostDeliveryRecord | undefined {
    return this.records.get(connectionId)?.get(hostId);
  }

  name(connectionId: string, label: string): void {
    this.labels.set(connectionId, label);
  }

  labelOf(connectionId: string): string {
    return this.labels.get(connectionId) ?? connectionId;
  }

  /** The connections this host still owes a revocation. */
  owedTo(hostId: ExecutionHostId): string[] {
    return [...this.records]
      .filter(([, hosts]) => hosts.get(hostId)?.revokePending === true)
      .map(([id]) => id);
  }

  forget(connectionId: string): void {
    this.labels.delete(connectionId);
    this.records.delete(connectionId);
  }

  /** A connection erased from the vault stays listed while a host may still hold its key. */
  snapshot(targets: LinearDaemonTarget[], storedIds: string[]): LinearDeliverySnapshot {
    const owed = [...this.records]
      .filter(([, hosts]) => [...hosts.values()].some((record) => record.revokePending))
      .map(([id]) => id);
    const stored = new Set(storedIds);
    return {
      connections: [...new Set([...storedIds, ...owed])].map((id) => ({
        connection_id: id,
        hosts: targets.map((target) =>
          hostDelivery(target, this.get(id, target.id), stored.has(id)),
        ),
      })),
    };
  }
}
