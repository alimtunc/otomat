import type {
  ExecutionHostId,
  LinearDeliverySnapshot,
  LinearHostDeliveryState,
} from "@otomat/domain";
import { vi } from "vitest";

import { LinearCoordinator } from "#main/linear/coordinator";
import type { LinearDaemonTarget } from "#main/linear/targets";
import type { LinearVault } from "#shared/linear-vault";

export const LOCAL_URL = "http://127.0.0.1:4319";
export const REMOTE_URL = "http://127.0.0.1:45010";

const CONNECTED = {
  status: "connected",
  workspace_id: "workspace-1",
  workspace_name: "Otomat",
  user_name: "Alim",
  error_code: null,
  error_message: null,
} as const;

const DISCONNECTED = {
  status: "disconnected",
  workspace_id: null,
  workspace_name: null,
  user_name: null,
  error_code: null,
  error_message: null,
} as const;

const LABELS: Record<ExecutionHostId, string> = { local: "Local", remote: "otomat-vps" };

export function reachable(id: ExecutionHostId, url: string): LinearDaemonTarget {
  return { id, label: LABELS[id], url, unavailable: null };
}

export function unreachable(id: ExecutionHostId, reason: string): LinearDaemonTarget {
  return { id, label: LABELS[id], url: null, unavailable: reason };
}

/** One daemon double answering `/api/linear/*` the way the real service would, in memory. */
export class FakeDaemon {
  connected = false;
  connectCount = 0;
  disconnectCount = 0;

  constructor(readonly url: string) {}

  handle(path: string): Response {
    if (path === "/api/linear/connection") {
      return Response.json(this.connected ? CONNECTED : DISCONNECTED);
    }
    if (path === "/api/linear/connect") {
      this.connectCount += 1;
      this.connected = true;
      return Response.json(CONNECTED);
    }
    this.disconnectCount += 1;
    this.connected = false;
    return Response.json(DISCONNECTED);
  }
}

/** Routes global fetch to the doubles by origin; an unrouted origin fails loudly instead of passing silently. */
export function routeDaemons(daemons: FakeDaemon[]): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const daemon = daemons.find((candidate) => candidate.url === url.origin);
      if (daemon === undefined) {
        return Promise.reject(new TypeError(`fetch failed: no daemon at ${url.origin}`));
      }
      return Promise.resolve(daemon.handle(url.pathname));
    }),
  );
}

export interface MemoryVault extends LinearVault {
  stored(): string | null;
}

export function memoryVault(initial: string | null = null): MemoryVault {
  let stored = initial;
  return {
    clear: () => (stored = null),
    load: () => stored,
    save: (apiKey: string) => (stored = apiKey),
    stored: () => stored,
  };
}

export interface CoordinatorHarness {
  coordinator: LinearCoordinator;
  /** Swaps the target list, as a host connecting or dropping does. */
  setTargets(targets: LinearDaemonTarget[]): void;
  /** Every snapshot the coordinator pushed to the renderer, in order. */
  deliveries: LinearDeliverySnapshot[];
  state(hostId: ExecutionHostId): LinearHostDeliveryState | undefined;
}

export function harness(vault: LinearVault, targets: LinearDaemonTarget[]): CoordinatorHarness {
  let current = targets;
  const deliveries: LinearDeliverySnapshot[] = [];
  const coordinator = new LinearCoordinator({
    vault,
    targets: () => current,
    onDelivery: (snapshot) => deliveries.push(snapshot),
  });
  return {
    coordinator,
    setTargets: (next) => (current = next),
    deliveries,
    state: (hostId) => coordinator.snapshot().hosts.find((host) => host.host_id === hostId)?.state,
  };
}
