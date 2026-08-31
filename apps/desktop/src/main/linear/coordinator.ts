import {
  connectLinearRequestSchema,
  type LinearDeliverySnapshot,
  type LinearVaultOperationResult,
} from "@otomat/domain";

import { LinearHandoffError } from "#shared/linear-handoff";
import type { LinearVault, LinearVaultKeys } from "#shared/linear-vault";

import { holdsNothing, mayHoldKey } from "./delivery.js";
import {
  cataloguedConnections,
  describeFailure,
  pushToHost,
  restoreOnHost,
  revokeOnHost,
} from "./hosts.js";
import { LinearDeliveryLedger } from "./ledger.js";
import type { LinearDaemonTarget } from "./targets.js";

export interface LinearCoordinatorOptions {
  vault: LinearVault;
  /** Every daemon the keys belong on, re-read before each operation. */
  targets(): LinearDaemonTarget[];
  onDelivery(snapshot: LinearDeliverySnapshot): void;
}

interface PushedHost {
  target: LinearDaemonTarget;
  url: string;
}

/**
 * The catalogue of Linear connections for the whole app. Every key lives only in
 * this machine's encrypted vault; each execution host's daemon receives it over
 * that host's own HTTP API — through the SSH tunnel for a remote host — and holds
 * it in memory. Restores and revocations are tracked per connection and per host,
 * so one unreachable workspace never stalls another.
 */
export class LinearCoordinator {
  private tail: Promise<void> = Promise.resolve();
  private readonly ledger = new LinearDeliveryLedger();

  constructor(private readonly options: LinearCoordinatorOptions) {}

  save(request: unknown): Promise<LinearVaultOperationResult> {
    return this.enqueue(() => this.saveNow(request));
  }

  forget(connectionId: unknown): Promise<LinearVaultOperationResult> {
    return this.enqueue(() => this.forgetNow(connectionId));
  }

  /** Brings every reachable host in line with the vault: at boot, and whenever a daemon reappears. */
  reconcile(): Promise<void> {
    return this.enqueue(() => this.reconcileNow());
  }

  snapshot(): LinearDeliverySnapshot {
    return this.ledger.snapshot(this.options.targets(), Object.keys(this.vaultKeys() ?? {}));
  }

  /** Null when the vault cannot be read — never an empty catalogue, which would revoke every key. */
  private vaultKeys(): LinearVaultKeys | null {
    try {
      return this.options.vault.load();
    } catch (error) {
      console.error("[otomat-desktop] reading the Linear vault failed", error);
      return null;
    }
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

  private async saveNow(input: unknown): Promise<LinearVaultOperationResult> {
    const parsed = connectLinearRequestSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        message: "Name the connection and paste a Linear Personal API key.",
        error_code: null,
      };
    }
    const request = parsed.data;
    // Named before the first push: a save that only half-lands still shows a label, not a raw id.
    this.ledger.name(request.id, request.label);
    const accepted: PushedHost[] = [];
    let refusal: LinearHandoffError | null = null;
    for (const target of this.options.targets()) {
      if (target.url === null) {
        this.ledger.set(request.id, target.id, holdsNothing(target.unavailable));
        continue;
      }
      const push = await pushToHost(this.ledger, target, target.url, request);
      if (push.delivered) accepted.push({ target, url: target.url });
      else refusal ??= push.refusal;
    }
    if (accepted.length === 0) return this.refuseSave(refusal);
    const keys = this.vaultKeys();
    // An unreadable vault may still hold a previous key, so the failure path treats it as a rotation.
    const replaced = keys === null || keys[request.id] !== undefined;
    try {
      this.options.vault.save(request.id, request.api_key);
    } catch (error) {
      return this.rollbackSave(request.id, accepted, replaced, error);
    }
    this.publish();
    return { ok: true, message: null };
  }

  /** No daemon took the key, so nothing new is stored and every host is re-read. */
  private async refuseSave(
    refusal: LinearHandoffError | null,
  ): Promise<LinearVaultOperationResult> {
    await this.reconcileNow();
    if (refusal !== null) return { ok: false, message: refusal.message, error_code: refusal.code };
    return {
      ok: false,
      message: "No daemon could take the Linear key. Check that a host is reachable, then retry.",
      error_code: null,
    };
  }

  /** The daemons accepted a key the vault refused: a rotation reverts to the vaulted key, a first save revokes. */
  private async rollbackSave(
    connectionId: string,
    accepted: PushedHost[],
    replaced: boolean,
    cause: unknown,
  ): Promise<LinearVaultOperationResult> {
    const message = describeFailure(cause, "Saving the Linear key failed.");
    if (replaced) {
      for (const { target } of accepted) this.ledger.set(connectionId, target.id, holdsNothing());
      await this.reconcileNow();
      return { ok: false, message, error_code: null };
    }
    const pending: string[] = [];
    for (const { target, url } of accepted) {
      if (!(await revokeOnHost(this.ledger, target, url, connectionId))) {
        pending.push(target.label);
      }
    }
    this.publish();
    if (pending.length === 0) return { ok: false, message, error_code: null };
    return {
      ok: false,
      message: `${message} The daemon connection could not be rolled back.`,
      error_code: null,
    };
  }

  private async forgetNow(connectionId: unknown): Promise<LinearVaultOperationResult> {
    if (typeof connectionId !== "string" || connectionId === "") {
      return { ok: false, message: "Name the Linear connection to disconnect.", error_code: null };
    }
    try {
      this.options.vault.forget(connectionId);
    } catch (error) {
      const message = describeFailure(error, "Forgetting the Linear key failed.");
      return { ok: false, message, error_code: null };
    }
    const pending = await this.revokeEverywhere(connectionId);
    if (pending.length === 0) this.ledger.forget(connectionId);
    this.publish();
    if (pending.length === 0) return { ok: true, message: null };
    return {
      ok: false,
      message: `The key is erased on this machine, but ${pending.join(", ")} could not be reached. Linear is revoked there as soon as it reconnects.`,
      error_code: null,
    };
  }

  /** Revokes one connection on every target; an unreachable one is owed the revocation. */
  private async revokeEverywhere(connectionId: string): Promise<string[]> {
    const pending: string[] = [];
    for (const target of this.options.targets()) {
      if (target.url === null) {
        this.ledger.set(connectionId, target.id, mayHoldKey(target.unavailable));
        pending.push(target.label);
        continue;
      }
      if (!(await revokeOnHost(this.ledger, target, target.url, connectionId))) {
        pending.push(target.label);
      }
    }
    return pending;
  }

  private async reconcileNow(): Promise<void> {
    const keys = this.vaultKeys();
    if (keys === null) return;
    for (const target of this.options.targets()) {
      if (target.url === null) continue;
      await this.reconcileTarget(target, target.url, keys);
    }
    this.publish();
  }

  private async reconcileTarget(
    target: LinearDaemonTarget,
    url: string,
    keys: LinearVaultKeys,
  ): Promise<void> {
    let catalogued: string[];
    let held: Set<string>;
    try {
      const connections = await cataloguedConnections(this.ledger, url);
      catalogued = connections.map((connection) => connection.id);
      held = new Set(
        connections
          .filter((connection) => connection.status === "connected")
          .map((connection) => connection.id),
      );
    } catch (error) {
      const detail = describeFailure(error, "Reading the Linear connections failed.");
      for (const id of Object.keys(keys)) {
        const known = this.ledger.get(id, target.id);
        this.ledger.set(
          id,
          target.id,
          known?.revokePending === true ? mayHoldKey(detail) : holdsNothing(detail),
        );
      }
      return;
    }
    for (const [id, apiKey] of Object.entries(keys)) {
      const request = { id, label: this.ledger.labelOf(id), api_key: apiKey };
      await restoreOnHost(this.ledger, target, url, request, held.has(id));
    }
    // A catalogued row the vault no longer names is revoked even when the daemon lost its key.
    for (const id of new Set([...catalogued, ...this.ledger.owedTo(target.id)])) {
      if (keys[id] === undefined) await revokeOnHost(this.ledger, target, url, id);
    }
  }
}
