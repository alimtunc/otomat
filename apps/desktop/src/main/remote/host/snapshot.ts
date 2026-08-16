import type {
  ExecutionHostDescriptor,
  ExecutionHostId,
  ExecutionHostSnapshot,
  RemoteHostStatus,
} from "@otomat/domain";

export interface ExecutionHostSnapshotInput {
  activeId: ExecutionHostId;
  /** Configured ssh alias; a null one means this app knows only the local host. */
  alias: string | null;
  status: RemoteHostStatus | null;
  remoteBuild: string | null;
  expectedBuild: string | null;
  updateError: string | null;
}

/** The host list and remote standing every surface reads, built in one place so a shell that is not ready yet answers the same shape. */
export function executionHostSnapshot(input: ExecutionHostSnapshotInput): ExecutionHostSnapshot {
  const hosts: ExecutionHostDescriptor[] = [{ id: "local", label: "Local", kind: "local" }];
  if (input.alias !== null) hosts.push({ id: "remote", label: input.alias, kind: "ssh" });
  return {
    hosts,
    active_id: input.activeId,
    remote_ssh_alias: input.alias,
    remote_status: input.status,
    remote_build: input.remoteBuild,
    expected_build: input.expectedBuild,
    remote_update_error: input.updateError,
  };
}
