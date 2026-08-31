import type { ConnectLinearRequest, LinearConnectionContract } from "@otomat/domain";

import {
  clearLinearKey,
  LinearHandoffError,
  pushLinearKey,
  readLinearConnections,
} from "#shared/linear-handoff";

import { holdsKey, holdsNothing, mayHoldKey } from "./delivery.js";
import type { LinearDeliveryLedger } from "./ledger.js";
import type { LinearDaemonTarget } from "./targets.js";

export function describeFailure(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/** That daemon's whole catalogue; only a `connected` row still holds a usable key. */
export async function cataloguedConnections(
  ledger: LinearDeliveryLedger,
  url: string,
): Promise<LinearConnectionContract[]> {
  const catalogued = await readLinearConnections(url);
  for (const connection of catalogued) ledger.name(connection.id, connection.label);
  return catalogued;
}

export type PushOutcome =
  | { delivered: true }
  | { delivered: false; refusal: LinearHandoffError | null };

export async function pushToHost(
  ledger: LinearDeliveryLedger,
  target: LinearDaemonTarget,
  url: string,
  request: ConnectLinearRequest,
): Promise<PushOutcome> {
  try {
    await pushLinearKey(url, request);
    ledger.set(request.id, target.id, holdsKey());
    return { delivered: true };
  } catch (error) {
    ledger.set(
      request.id,
      target.id,
      holdsNothing(describeFailure(error, "Connecting Linear failed.")),
    );
    return { delivered: false, refusal: error instanceof LinearHandoffError ? error : null };
  }
}

export async function restoreOnHost(
  ledger: LinearDeliveryLedger,
  target: LinearDaemonTarget,
  url: string,
  request: ConnectLinearRequest,
  daemonHoldsKey: boolean,
): Promise<void> {
  if (daemonHoldsKey && ledger.get(request.id, target.id)?.holdsCurrentKey === true) return;
  await pushToHost(ledger, target, url, request);
}

export async function revokeOnHost(
  ledger: LinearDeliveryLedger,
  target: LinearDaemonTarget,
  url: string,
  connectionId: string,
): Promise<boolean> {
  try {
    await clearLinearKey(url, connectionId);
  } catch (error) {
    // A daemon that never catalogued the connection owes nothing: that revocation is complete.
    if (!(error instanceof LinearHandoffError && error.code === "linear_connection_not_found")) {
      ledger.set(
        connectionId,
        target.id,
        mayHoldKey(describeFailure(error, "Disconnecting Linear failed.")),
      );
      return false;
    }
  }
  ledger.set(connectionId, target.id, holdsNothing());
  return true;
}
