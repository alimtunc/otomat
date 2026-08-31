import type { ExecutionHostDescriptor, WorkspaceEntry } from "@otomat/domain";

/** A worktree with the host holding it: the same path or branch can exist on two hosts, so neither identifies a row alone. */
export interface WorkspaceRow extends WorkspaceEntry {
  host: ExecutionHostDescriptor;
}
