import { isExecutionHostId, type ExecutionHostId } from "@otomat/domain";

/** Payload of the synchronous execution-host handshake the preload performs before exposing the bridge. */
export interface ExecutionHostSync {
  id: ExecutionHostId;
  ssh_alias: string | null;
}

export function isExecutionHostSync(value: unknown): value is ExecutionHostSync {
  if (typeof value !== "object" || value === null) return false;
  const sync = value as Record<string, unknown>;
  return (
    isExecutionHostId(sync.id) && (typeof sync.ssh_alias === "string" || sync.ssh_alias === null)
  );
}
