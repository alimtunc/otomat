import { isExecutionHostId, type ExecutionHostId } from "@otomat/domain";

/** Switcher item ids are host-qualified: project ids alone can collide across daemons (e.g. `local-default`). */
export function projectSwitcherKey(hostId: ExecutionHostId, projectId: string): string {
  return `${hostId}:${projectId}`;
}

export interface ParsedProjectSwitcherKey {
  hostId: ExecutionHostId;
  projectId: string;
}

export function parseProjectSwitcherKey(
  key: string,
  fallbackHost: ExecutionHostId,
): ParsedProjectSwitcherKey {
  const separator = key.indexOf(":");
  if (separator === -1) return { hostId: fallbackHost, projectId: key };
  const hostId = key.slice(0, separator);
  if (!isExecutionHostId(hostId)) return { hostId: fallbackHost, projectId: key };
  return { hostId, projectId: key.slice(separator + 1) };
}
