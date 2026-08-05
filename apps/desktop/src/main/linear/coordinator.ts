import type {
  ExecutionHostId,
  LinearDeliverySnapshot,
  LinearHostDelivery,
  LinearVaultOperationResult,
} from "@otomat/domain";

import {
  clearLinearKey,
  LinearHandoffError,
  pushLinearKey,
  readLinearConnection,
} from "#shared/linear-handoff";
import type { LinearVault } from "#shared/linear-vault";

import {
  holdsKey,
  holdsNothing,
  hostDelivery,
  mayHoldKey,
  type HostDeliveryRecord,
} from "./delivery.js";
import type { LinearDaemonTarget } from "./targets.js";

function describeFailure(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export interface LinearCoordinatorOptions {
  vault: LinearVault;
  /** Every daemon the key belongs on, re-read before each operation. */
  targets(): LinearDaemonTarget[];
  onDelivery(snapshot: LinearDeliverySnapshot): void;
}

/**
 * One Linear connection for the whole app. The key lives only in this machine's
 * encrypted vault; each execution host's daemon receives it over that host's own
 * HTTP API — through the SSH tunnel for a remote host — and holds it in memory. A
 * host that is down keeps its pending restore or revocation until it answers again.
 */
export class LinearCoordinator {
  private tail: Promise<void> = Promise.resolve();
  private stored = false;
  private readonly records = new Map<ExecutionHostId, HostDeliveryRecord>();

  constructor(private readonly options: LinearCoordinatorOptions) {}

  save(apiKey: unknown): Promise<LinearVaultOperationResult> {
    return this.enqueue(() => this.saveNow(apiKey));
  }

  forget(): Promise<LinearVaultOperationResult> {
    return this.enqueue(() => this.forgetNow());
  }

  /** Brings every reachable host in line with the vault: at boot, and whenever a daemon reappears. */
  reconcile(): Promise<void> {
    return this.enqueue(() => this.reconcileNow());
  }

  snapshot(): LinearDeliverySnapshot {
    const hosts: LinearHostDelivery[] = [];
    for (const target of this.options.targets()) {
      hosts.push(hostDelivery(target, this.records.get(target.id), this.stored));
    }
    return { stored: this.stored, hosts };
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.tail.then(operation);
    this.tail = next.then(
      () => undefined,
      (error) => console.error("[otomat-desktop] queued Linear operation failed", error),
    );
    return next;
  }

  private publish(): void {
    this.options.onDelivery(this.snapshot());
  }

  private async saveNow(apiKey: unknown): Promise<LinearVaultOperationResult> {
    if (typeof apiKey !== "string" || apiKey.trim() === "") {
      return { ok: false, message: "Provide a Linear Personal API key.", error_code: null };
    }
    const normalizedKey = apiKey.trim();
    // A new key invalidates what every host was told before, reachable or not.
    this.records.clear();
    const accepted: { id: ExecutionHostId; url: string }[] = [];
    let refusal: LinearHandoffError | null = null;
    for (const target of this.options.targets()) {
      const url = target.url;
      if (url === null) {
        this.records.set(target.id, holdsNothing(target.unavailable));
        continue;
      }
      try {
        await pushLinearKey({ daemonUrl: url, apiKey: normalizedKey });
        this.records.set(target.id, holdsKey());
        accepted.push({ id: target.id, url });
      } catch (error) {
        if (error instanceof LinearHandoffError) refusal ??= error;
        const detail = describeFailure(error, "Connecting Linear failed.");
        this.records.set(target.id, holdsNothing(detail));
      }
    }
    if (accepted.length === 0) return this.refuseSave(refusal);
    try {
      this.options.vault.save(normalizedKey);
    } catch (error) {
      return this.rollbackSave(accepted, error);
    }
    this.stored = true;
    this.publish();
    return { ok: true, message: null };
  }

  /** No daemon took the key, so nothing is stored: the connection never happened. */
  private refuseSave(refusal: LinearHandoffError | null): LinearVaultOperationResult {
    this.publish();
    if (refusal !== null) return { ok: false, message: refusal.message, error_code: refusal.code };
    return {
      ok: false,
      message: "No daemon could take the Linear key. Check that a host is reachable, then retry.",
      error_code: null,
    };
  }

  private async rollbackSave(
    accepted: { id: ExecutionHostId; url: string }[],
    cause: unknown,
  ): Promise<LinearVaultOperationResult> {
    const message = describeFailure(cause, "Saving the Linear key failed.");
    let pending = false;
    for (const host of accepted) {
      try {
        await clearLinearKey(host.url);
        this.records.set(host.id, holdsNothing());
      } catch (error) {
        console.error("[otomat-desktop] rolling back the Linear connection failed", error);
        this.records.set(host.id, mayHoldKey(describeFailure(error, "Rolling back failed.")));
        pending = true;
      }
    }
    this.publish();
    if (!pending) return { ok: false, message, error_code: null };
    const detail = "The daemon connection could not be rolled back.";
    return { ok: false, message: `${message} ${detail}`, error_code: null };
  }

  private async forgetNow(): Promise<LinearVaultOperationResult> {
    try {
      this.options.vault.clear();
    } catch (error) {
      const message = describeFailure(error, "Forgetting the Linear key failed.");
      return { ok: false, message, error_code: null };
    }
    this.stored = false;
    this.records.clear();
    const pending: string[] = [];
    for (const target of this.options.targets()) {
      const url = target.url;
      if (url === null) {
        // An unreachable host may still hold the key: assume it does until it says otherwise.
        this.records.set(target.id, mayHoldKey(target.unavailable));
        pending.push(target.label);
        continue;
      }
      try {
        await clearLinearKey(url);
        this.records.set(target.id, holdsNothing());
      } catch (error) {
        this.records.set(target.id, mayHoldKey(describeFailure(error, "Disconnecting failed.")));
        pending.push(target.label);
      }
    }
    this.publish();
    if (pending.length === 0) return { ok: true, message: null };
    return {
      ok: false,
      message: `The key is erased on this machine, but ${pending.join(", ")} could not be reached. Linear is revoked there as soon as it reconnects.`,
      error_code: null,
    };
  }

  private async reconcileNow(): Promise<void> {
    let apiKey: string | null;
    try {
      apiKey = this.options.vault.load();
    } catch (error) {
      console.error("[otomat-desktop] restoring the Linear connection failed", error);
      return;
    }
    this.stored = apiKey !== null;
    for (const target of this.options.targets()) {
      if (target.url === null) continue;
      await this.reconcileTarget(target.id, target.url, apiKey);
    }
    this.publish();
  }

  private async reconcileTarget(
    id: ExecutionHostId,
    url: string,
    apiKey: string | null,
  ): Promise<void> {
    let daemonHoldsKey: boolean;
    try {
      // A daemon's own connection state is the only thing that survives its restarts.
      daemonHoldsKey = (await readLinearConnection(url)).status === "connected";
    } catch (error) {
      const detail = describeFailure(error, "Reading the Linear connection failed.");
      const known = this.records.get(id) ?? holdsNothing();
      this.records.set(id, { ...known, detail });
      return;
    }
    // Revocation runs before anything can re-expose Linear on this host.
    if (apiKey === null) return this.revokeOn(id, url, daemonHoldsKey);
    if (daemonHoldsKey && this.records.get(id)?.holdsCurrentKey === true) return;
    try {
      await pushLinearKey({ daemonUrl: url, apiKey });
      this.records.set(id, holdsKey());
    } catch (error) {
      this.records.set(id, holdsNothing(describeFailure(error, "Connecting Linear failed.")));
    }
  }

  private async revokeOn(id: ExecutionHostId, url: string, daemonHoldsKey: boolean): Promise<void> {
    if (!daemonHoldsKey) {
      this.records.set(id, holdsNothing());
      return;
    }
    try {
      await clearLinearKey(url);
      this.records.set(id, holdsNothing());
    } catch (error) {
      this.records.set(id, mayHoldKey(describeFailure(error, "Disconnecting Linear failed.")));
    }
  }
}

/** The result every Linear IPC action degrades to while the runtime is still booting. */
export function unavailableLinear(): LinearVaultOperationResult {
  return { ok: false, message: "The desktop runtime is not ready yet.", error_code: null };
}
