import {
  isExecutionHostId,
  type ExecutionHostOperationResult,
  type ExecutionHostProjectsEntry,
  type ExecutionHostSnapshot,
} from "@otomat/domain";

import type { ExecutionHostSync } from "#shared/execution-host-sync";

import type { ExecutionHostManager } from "./manager.js";

/** Renderer-facing host actions; every call degrades honestly while the runtime is still booting. */
export interface ExecutionHostIpcActions {
  sync(): ExecutionHostSync;
  snapshot(): ExecutionHostSnapshot;
  select(id: unknown): Promise<ExecutionHostOperationResult>;
  configureRemote(sshAlias: unknown): ExecutionHostOperationResult;
  listAliases(): string[];
  listProjects(): Promise<ExecutionHostProjectsEntry[]>;
}

const NOT_READY: ExecutionHostOperationResult = {
  ok: false,
  message: "The desktop runtime is not ready yet.",
};

export function buildExecutionHostActions(
  manager: () => ExecutionHostManager | null,
): ExecutionHostIpcActions {
  return {
    sync: () => {
      const hosts = manager();
      if (hosts === null) return { id: "local", ssh_alias: null };
      return { id: hosts.activeHostId, ssh_alias: hosts.remoteSshAlias };
    },
    snapshot: () => {
      const hosts = manager();
      if (hosts === null) {
        return {
          hosts: [{ id: "local", label: "Local", kind: "local" }],
          active_id: "local",
          remote_ssh_alias: null,
          remote_status: null,
          remote_build: null,
          expected_build: null,
        };
      }
      return hosts.snapshot();
    },
    select: async (id: unknown) => {
      const hosts = manager();
      if (hosts === null) return NOT_READY;
      if (!isExecutionHostId(id)) return { ok: false, message: "Unknown execution host." };
      return hosts.select(id);
    },
    configureRemote: (sshAlias: unknown) => {
      const hosts = manager();
      if (hosts === null) return NOT_READY;
      return hosts.configureRemote(sshAlias);
    },
    listAliases: () => manager()?.listAliases() ?? [],
    listProjects: async () => manager()?.listProjects() ?? [],
  };
}
