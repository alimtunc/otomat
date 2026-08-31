import {
  connectLinearRequestSchema,
  type ExecutionHostId,
  type LinearConnectionContract,
  type LinearDeliverySnapshot,
  type LinearHostDeliveryState,
} from "@otomat/domain";
import { vi } from "vitest";

import { LinearCoordinator } from "#main/linear/coordinator";
import type { LinearDaemonTarget } from "#main/linear/targets";
import type { LinearVault, LinearVaultKeys } from "#shared/linear-vault";

export const LOCAL_URL = "http://127.0.0.1:4319";
export const REMOTE_URL = "http://127.0.0.1:45010";

export const OTOMAT = { id: "otomat", label: "Otomat", api_key: "lin_api_otomat" };
export const CRM = { id: "crm", label: "CRM", api_key: "lin_api_crm" };

export function connected(id: string, label: string): LinearConnectionContract {
  return {
    id,
    label,
    workspace_id: `workspace-${id}`,
    workspace_name: label,
    user_name: "Alim",
    status: "connected",
    error_code: null,
    error_message: null,
  };
}

const LABELS = { local: "Local", remote: "otomat-vps" } satisfies Record<ExecutionHostId, string>;

export function reachable(id: ExecutionHostId, url: string): LinearDaemonTarget {
  return { id, label: LABELS[id], url, unavailable: null };
}

export function unreachable(id: ExecutionHostId, reason: string): LinearDaemonTarget {
  return { id, label: LABELS[id], url: null, unavailable: reason };
}

/** One daemon double answering `/api/linear/*` the way the real service would, in memory. */
export class FakeDaemon {
  connectCount = 0;
  disconnectCount = 0;
  /** The keys this daemon currently holds in memory, by connection id. */
  readonly keys = new Map<string, string>();
  private readonly labels = new Map<string, string>();
  /** The one key Linear refuses; every other key is accepted. */
  rejects: string | null = null;

  constructor(readonly url: string) {}

  holds(connectionId: string): boolean {
    return this.keys.has(connectionId);
  }

  /** A key kept from an earlier desktop session: catalogued and connected without a push. */
  adopt(id: string, label: string, apiKey: string): void {
    this.labels.set(id, label);
    this.keys.set(id, apiKey);
  }

  handle(path: string, method: string, body: RequestInit["body"]): Response {
    if (path === "/api/linear/connections" && method === "GET") {
      // A restarted daemon still catalogues its rows in SQLite; only the in-memory keys are gone.
      return Response.json(
        [...this.labels].map(([id, label]) => ({
          ...connected(id, label),
          status: this.keys.has(id) ? ("connected" as const) : ("disconnected" as const),
        })),
      );
    }
    if (path === "/api/linear/connections" && method === "POST") {
      this.connectCount += 1;
      const request = connectLinearRequestSchema.parse(JSON.parse(String(body)));
      // The daemon clears the credential before validating, so a refusal leaves it holding nothing.
      this.keys.delete(request.id);
      if (request.api_key === this.rejects) {
        return Response.json(
          { error: "linear_unauthorized", message: "Linear rejected the API key." },
          { status: 409 },
        );
      }
      this.labels.set(request.id, request.label);
      this.keys.set(request.id, request.api_key);
      return Response.json(connected(request.id, request.label));
    }
    const removed = /^\/api\/linear\/connections\/([^/]+)$/.exec(path);
    if (removed !== null && method === "DELETE") {
      const id = decodeURIComponent(removed[1] ?? "");
      if (!this.labels.has(id)) {
        return Response.json(
          { error: "linear_connection_not_found", message: "No Linear connection has this id." },
          { status: 404 },
        );
      }
      this.disconnectCount += 1;
      this.labels.delete(id);
      this.keys.delete(id);
      return new Response(null, { status: 204 });
    }
    throw new Error(`FakeDaemon has no route for ${method} ${path}`);
  }
}

/** Routes global fetch to the doubles by origin; an unrouted origin fails loudly instead of passing silently. */
export function routeDaemons(daemons: FakeDaemon[]): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = new URL(String(input));
      const daemon = daemons.find((candidate) => candidate.url === url.origin);
      if (daemon === undefined) {
        return Promise.reject(new TypeError(`fetch failed: no daemon at ${url.origin}`));
      }
      return Promise.resolve(daemon.handle(url.pathname, init?.method ?? "GET", init?.body));
    }),
  );
}

export interface MemoryVault extends LinearVault {
  stored(): LinearVaultKeys;
}

export function memoryVault(initial: LinearVaultKeys = {}): MemoryVault {
  const keys: LinearVaultKeys = { ...initial };
  return {
    forget: (connectionId) => delete keys[connectionId],
    load: () => ({ ...keys }),
    save: (connectionId, apiKey) => {
      keys[connectionId] = apiKey;
    },
    stored: () => ({ ...keys }),
  };
}

export interface CoordinatorHarness {
  coordinator: LinearCoordinator;
  /** Swaps the target list, as a host connecting or dropping does. */
  setTargets(targets: LinearDaemonTarget[]): void;
  /** Every snapshot the coordinator pushed to the renderer, in order. */
  deliveries: LinearDeliverySnapshot[];
  /** Read from the last pushed snapshot, so asserting a state also proves the cockpit was told. */
  state(connectionId: string, hostId: ExecutionHostId): LinearHostDeliveryState | undefined;
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
    state: (connectionId, hostId) =>
      deliveries
        .at(-1)
        ?.connections.find((connection) => connection.connection_id === connectionId)
        ?.hosts.find((host) => host.host_id === hostId)?.state,
  };
}
