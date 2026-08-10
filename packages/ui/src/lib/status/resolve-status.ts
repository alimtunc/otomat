import { STATUS_REGISTRY } from "./registry";
import type { KindStatusMap, StatusDescriptor, StatusKind } from "./types";

/** Resolves the visual descriptor (tone, icon, label) for a domain status; total over every state of each `StatusKind`. */
export function resolveStatus<K extends StatusKind>(
  kind: K,
  status: KindStatusMap[K],
): StatusDescriptor {
  return STATUS_REGISTRY[kind][status];
}
