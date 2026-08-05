import type { LinearHostDelivery } from "@otomat/domain";

import type { LinearDaemonTarget } from "./targets.js";

/** What the last exchange with one host's daemon established about the vault key. */
export interface HostDeliveryRecord {
  /** True once that daemon accepted the key currently in the vault. */
  holdsCurrentKey: boolean;
  /** True while the host may still hold a key the vault no longer has. */
  revokePending: boolean;
  /** The failure that left the host out of line with the vault; null when it is in line. */
  detail: string | null;
}

export function holdsKey(): HostDeliveryRecord {
  return { holdsCurrentKey: true, revokePending: false, detail: null };
}

export function holdsNothing(detail: string | null = null): HostDeliveryRecord {
  return { holdsCurrentKey: false, revokePending: false, detail };
}

export function mayHoldKey(detail: string | null): HostDeliveryRecord {
  return { holdsCurrentKey: false, revokePending: true, detail };
}

/**
 * Confirmed states only hold while the host answers: an unreachable host reports
 * what is still owed to it, never a delivery Otomat can no longer verify.
 */
export function hostDelivery(
  target: LinearDaemonTarget,
  record: HostDeliveryRecord | undefined,
  stored: boolean,
): LinearHostDelivery {
  const host = { host_id: target.id, label: target.label };
  if (target.url === null) {
    if (stored && record?.holdsCurrentKey !== true) {
      return { ...host, state: "pending_restore", detail: target.unavailable };
    }
    if (!stored && record?.revokePending === true) {
      return { ...host, state: "pending_revocation", detail: target.unavailable };
    }
    return { ...host, state: "unavailable", detail: target.unavailable };
  }
  if (stored) {
    return record?.holdsCurrentKey === true
      ? { ...host, state: "delivered", detail: record.detail }
      : { ...host, state: "pending_restore", detail: record?.detail ?? null };
  }
  return record?.revokePending === true
    ? { ...host, state: "pending_revocation", detail: record.detail }
    : { ...host, state: "cleared", detail: record?.detail ?? null };
}
