import { isExecutionHostId, type ExecutionHostId } from "@otomat/domain";

/** Payload of the synchronous execution-host handshake the preload performs before exposing the bridge. */
export interface ExecutionHostSync {
  id: ExecutionHostId;
  ssh_alias: string | null;
}

export function isExecutionHostSync(value: unknown): value is ExecutionHostSync {
  if (typeof value !== "object" || value === null) return false;
  return (
    "id" in value &&
    isExecutionHostId(value.id) &&
    "ssh_alias" in value &&
    (typeof value.ssh_alias === "string" || value.ssh_alias === null)
  );
}
