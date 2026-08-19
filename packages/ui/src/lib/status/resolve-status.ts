import { STATUS_REGISTRY } from "./registry";
import type { KindStatusMap, StatusDescriptor, StatusKind, StatusMap } from "./types";

/** Resolves the visual descriptor (tone, icon, label) for a domain status; total over every state of each `StatusKind`. */
export function resolveStatus<K extends StatusKind>(
  kind: K,
  status: KindStatusMap[K],
): StatusDescriptor {
  // SAFETY: STATUS_REGISTRY satisfies the per-kind maps, so each kind's map is total over its statuses.
  const map = STATUS_REGISTRY[kind] as StatusMap<KindStatusMap[K]>;
  return map[status];
}
