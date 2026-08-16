import type { ExecutionHostId } from "@otomat/domain";

/** One daemon the Linear key belongs on, with the reason it cannot take it right now. */
export interface LinearDaemonTarget {
  id: ExecutionHostId;
  label: string;
  /** Base URL of that host's daemon, or null while it cannot be reached. */
  url: string | null;
  /** Why the daemon cannot be reached; null when `url` is set. */
  unavailable: string | null;
}

/** The slice of the execution-host manager the Linear fan-out reads. */
export interface LinearHostSource {
  readonly remoteSshAlias: string | null;
  readonly catalog: {
    resolveBaseUrl(hostId: ExecutionHostId): { url: string } | { message: string };
  };
}

type ResolvedDaemonUrl = ReturnType<LinearHostSource["catalog"]["resolveBaseUrl"]>;

function target(
  id: ExecutionHostId,
  label: string,
  resolved: ResolvedDaemonUrl,
): LinearDaemonTarget {
  if ("url" in resolved) return { id, label, url: resolved.url, unavailable: null };
  return { id, label, url: null, unavailable: resolved.message };
}

/**
 * Every daemon the single Linear connection must reach: this machine's, plus the
 * configured remote host. Resolving through the host manager warms an idle remote
 * host, so a reconnect that is already possible starts here.
 */
export function linearTargets(hosts: LinearHostSource): LinearDaemonTarget[] {
  const targets = [target("local", "Local", hosts.catalog.resolveBaseUrl("local"))];
  const alias = hosts.remoteSshAlias;
  if (alias !== null) targets.push(target("remote", alias, hosts.catalog.resolveBaseUrl("remote")));
  return targets;
}
