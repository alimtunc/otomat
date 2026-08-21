import {
  isExecutionHostId,
  type ExecutionHostCapacityResult,
  type ExecutionHostOperationResult,
  type ExecutionHostProjectsEntry,
  type ExecutionHostRegisterProjectResult,
  type ExecutionHostRepositoriesEntry,
  type ExecutionHostSnapshot,
  type RemoteInstanceListResult,
  type RemoteRepositoryListResult,
} from "@otomat/domain";

import type { ExecutionHostSync } from "#shared/execution-host-sync";

import type { HostCapacityActions } from "./host/capacity.js";
import { listRemoteRepositories } from "./host/repos.js";
import { executionHostSnapshot } from "./host/snapshot.js";
import type { RemoteInstanceActions } from "./instances/actions.js";
import type { ExecutionHostManager } from "./manager.js";

/** Renderer-facing host actions; every call degrades honestly while the runtime is still booting. */
export interface ExecutionHostIpcActions {
  sync(): ExecutionHostSync;
  snapshot(): ExecutionHostSnapshot;
  select(id: unknown): Promise<ExecutionHostOperationResult>;
  configureRemote(sshAlias: unknown): ExecutionHostOperationResult;
  removeRemote(): ExecutionHostOperationResult;
  registerProject(hostId: unknown, path: unknown): Promise<ExecutionHostRegisterProjectResult>;
  readCapacity(hostId: unknown): Promise<ExecutionHostCapacityResult>;
  writeCapacity(
    hostId: unknown,
    maxConcurrentSessions: unknown,
  ): Promise<ExecutionHostCapacityResult>;
  listAliases(): string[];
  listRemoteRepositories(): Promise<RemoteRepositoryListResult>;
  listProjects(): Promise<ExecutionHostProjectsEntry[]>;
  listRepositories(): Promise<ExecutionHostRepositoriesEntry[]>;
  deleteRepository(hostId: unknown, repositoryId: unknown): Promise<ExecutionHostOperationResult>;
  listInstances(): Promise<RemoteInstanceListResult>;
  stopInstance(build: unknown): Promise<ExecutionHostOperationResult>;
  deleteInstance(build: unknown): Promise<ExecutionHostOperationResult>;
  updateRemoteDaemon(): Promise<ExecutionHostOperationResult>;
}

const NOT_READY_MESSAGE = "The desktop runtime is not ready yet.";

const NOT_READY: ExecutionHostOperationResult = { ok: false, message: NOT_READY_MESSAGE };

export function buildExecutionHostActions(
  manager: () => ExecutionHostManager | null,
  instances: () => RemoteInstanceActions | null,
  capacity: () => HostCapacityActions | null,
): ExecutionHostIpcActions {
  return {
    sync: () => {
      const hosts = manager();
      if (hosts === null) return { id: "local", ssh_alias: null };
      return { id: hosts.activeHostId, ssh_alias: hosts.remoteSshAlias };
    },
    snapshot: () =>
      manager()?.snapshot() ??
      executionHostSnapshot({
        activeId: "local",
        alias: null,
        status: null,
        remoteBuild: null,
        expectedBuild: null,
        updateError: null,
      }),
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
    removeRemote: () => {
      const hosts = manager();
      if (hosts === null) return NOT_READY;
      return hosts.removeRemote();
    },
    registerProject: async (hostId: unknown, path: unknown) => {
      const hosts = manager();
      if (hosts === null) return { ok: false, message: NOT_READY_MESSAGE };
      if (!isExecutionHostId(hostId)) return { ok: false, message: "Unknown execution host." };
      if (typeof path !== "string") return { ok: false, message: "Enter a repository path." };
      return hosts.catalog.registerProject(hostId, path);
    },
    readCapacity: async (hostId: unknown) => {
      const actions = capacity();
      if (actions === null) return { ok: false, message: NOT_READY_MESSAGE };
      if (!isExecutionHostId(hostId)) return { ok: false, message: "Unknown execution host." };
      return actions.read(hostId);
    },
    writeCapacity: async (hostId: unknown, maxConcurrentSessions: unknown) => {
      const actions = capacity();
      if (actions === null) return { ok: false, message: NOT_READY_MESSAGE };
      if (!isExecutionHostId(hostId)) return { ok: false, message: "Unknown execution host." };
      if (
        typeof maxConcurrentSessions !== "number" ||
        !Number.isInteger(maxConcurrentSessions) ||
        maxConcurrentSessions < 1
      ) {
        return { ok: false, message: "Enter a whole number of sessions, 1 or more." };
      }
      return actions.write(hostId, maxConcurrentSessions);
    },
    listAliases: () => manager()?.listAliases() ?? [],
    listRemoteRepositories: async () => {
      const hosts = manager();
      if (hosts === null) return { ok: false, message: NOT_READY_MESSAGE };
      return listRemoteRepositories(hosts.remoteSshAlias);
    },
    listProjects: async () => manager()?.catalog.listProjects() ?? [],
    listRepositories: async () => manager()?.catalog.listRepositories() ?? [],
    deleteRepository: async (hostId: unknown, repositoryId: unknown) => {
      const hosts = manager();
      if (hosts === null) return NOT_READY;
      if (!isExecutionHostId(hostId)) return { ok: false, message: "Unknown execution host." };
      if (typeof repositoryId !== "string") {
        return { ok: false, message: "Unknown repository." };
      }
      return hosts.catalog.deleteRepository(hostId, repositoryId);
    },
    listInstances: async () => instances()?.list() ?? { ok: false, message: NOT_READY_MESSAGE },
    stopInstance: async (build: unknown) => instances()?.stop(build) ?? NOT_READY,
    deleteInstance: async (build: unknown) => instances()?.remove(build) ?? NOT_READY,
    updateRemoteDaemon: async () => manager()?.updateDaemon() ?? NOT_READY,
  };
}
