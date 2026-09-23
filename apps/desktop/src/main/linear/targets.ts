import type { DaemonEndpoint } from "@otomat/client";
import type { ExecutionHostId } from "@otomat/domain";

import type { ResolvedDaemonEndpoint } from "../remote/host/command-endpoint.js";

/** One daemon the Linear key belongs on, with the reason it cannot take it right now. */
export interface LinearDaemonTarget {
  id: ExecutionHostId;
  label: string;
  /** That host's daemon, or null while it cannot be reached. */
  endpoint: DaemonEndpoint | null;
  /** Why the daemon cannot be reached; null when `endpoint` is set. */
  unavailable: string | null;
}

/** The slice of the execution-host manager the Linear fan-out reads. */
export interface LinearHostSource {
  readonly remoteSshAlias: string | null;
  readonly catalog: {
    resolveEndpoint(hostId: ExecutionHostId): ResolvedDaemonEndpoint;
  };
}

function target(
  id: ExecutionHostId,
  label: string,
  resolved: ResolvedDaemonEndpoint,
): LinearDaemonTarget {
  if ("message" in resolved) return { id, label, endpoint: null, unavailable: resolved.message };
  return { id, label, endpoint: resolved, unavailable: null };
}

/**
 * Every daemon the single Linear connection must reach: this machine's, plus the
 * configured remote host. Resolving through the host manager warms an idle remote
 * host, so a reconnect that is already possible starts here.
 */
export function linearTargets(hosts: LinearHostSource): LinearDaemonTarget[] {
  const targets = [target("local", "Local", hosts.catalog.resolveEndpoint("local"))];
  const alias = hosts.remoteSshAlias;
  if (alias !== null)
    targets.push(target("remote", alias, hosts.catalog.resolveEndpoint("remote")));
  return targets;
}
