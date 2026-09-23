import {
  createDaemonClient,
  DaemonRequestError,
  DaemonTransportError,
  type DaemonEndpoint,
} from "@otomat/client";
import {
  repositoryDeletionErrorSchema,
  repositoryRegistrationErrorSchema,
  type ExecutionHostCallResult,
  type ExecutionHostDescriptor,
  type ExecutionHostId,
  type ExecutionHostOperationResult,
  type ExecutionHostProjectsEntry,
  type ExecutionHostRegisterProjectResult,
  type ExecutionHostRepositoriesEntry,
  type InboxSnapshot,
  type ProjectHealthReport,
  type RemoteHostStatus,
  type WorkspaceCleanupResult,
  type WorkspaceInventory,
  type WorkspaceReconcileReport,
} from "@otomat/domain";

import {
  currentEndpoint,
  resolveCommandEndpoint,
  type CommandEndpointOptions,
  type ResolvedDaemonEndpoint,
} from "./command-endpoint.js";
import { hostCommandRefusal } from "./refusal.js";

type DaemonClient = ReturnType<typeof createDaemonClient>;

/** One configured host with the endpoint its own daemon answers on, or null while it cannot be reached. */
export interface HostTarget {
  host: ExecutionHostDescriptor;
  active: boolean;
  status: RemoteHostStatus | null;
  endpoint: DaemonEndpoint | null;
}

export interface HostCatalogOptions extends CommandEndpointOptions {
  activeHostId(): ExecutionHostId;
  fetchImpl: typeof fetch;
  log(message: string): void;
}

export class HostCatalog {
  constructor(private readonly options: HostCatalogOptions) {}

  async listProjects(): Promise<ExecutionHostProjectsEntry[]> {
    return Promise.all(
      this.targets().map(async ({ endpoint, ...entry }) => ({
        ...entry,
        projects:
          endpoint === null ? null : await this.read(endpoint, "projects", (c) => c.listProjects()),
      })),
    );
  }

  async listRepositories(): Promise<ExecutionHostRepositoriesEntry[]> {
    return Promise.all(
      this.targets().map(async ({ endpoint, ...entry }) => ({
        ...entry,
        repositories:
          endpoint === null
            ? null
            : await this.read(endpoint, "repositories", (c) => c.listRepositories()),
      })),
    );
  }

  /** Failures come back as prose in the result, never as a throw. */
  async registerProject(
    hostId: ExecutionHostId,
    path: string,
  ): Promise<ExecutionHostRegisterProjectResult> {
    if (path.trim() === "") return { ok: false, message: "Enter a repository path on the host." };
    const target = await resolveCommandEndpoint(this.options, hostId);
    if ("message" in target) return { ok: false, message: target.message };
    try {
      const created = await this.client(target).registerRepository({ path: path.trim() });
      return { ok: true, project: created.project };
    } catch (error) {
      const refusal = hostCommandRefusal(
        error,
        hostId,
        "Register",
        this.options.log,
        (status, body) => {
          const parsed = repositoryRegistrationErrorSchema.safeParse(body);
          return parsed.success
            ? parsed.data.message
            : `The daemon refused the registration (HTTP ${status}).`;
        },
      );
      if (refusal !== null) return { ok: false, ...refusal };
      return {
        ok: false,
        message:
          "The daemon registered the repository but answered in an unknown format; refresh the project list.",
      };
    }
  }

  /** Deletes on the owning host alone: a host that cannot be reached says so instead of another host answering for it. */
  async deleteRepository(
    hostId: ExecutionHostId,
    repositoryId: string,
  ): Promise<ExecutionHostOperationResult> {
    const target = await resolveCommandEndpoint(this.options, hostId);
    if ("message" in target) return { ok: false, message: target.message };
    try {
      await this.client(target).deleteRepository(repositoryId);
      return { ok: true };
    } catch (error) {
      const refusal = hostCommandRefusal(
        error,
        hostId,
        "Delete",
        this.options.log,
        (status, body) => {
          const parsed = repositoryDeletionErrorSchema.safeParse(body);
          return parsed.success
            ? parsed.data.message
            : `The daemon refused the deletion (HTTP ${status}).`;
        },
      );
      if (refusal === null) throw error;
      return { ok: false, ...refusal };
    }
  }

  async readWorkspaces(
    hostId: ExecutionHostId,
  ): Promise<ExecutionHostCallResult<WorkspaceInventory>> {
    return this.call(hostId, (client) => client.listWorkspaces());
  }

  async readInbox(hostId: ExecutionHostId): Promise<ExecutionHostCallResult<InboxSnapshot>> {
    return this.call(hostId, (client) => client.listInbox());
  }

  async readProjectHealth(
    hostId: ExecutionHostId,
    projectId: string,
  ): Promise<ExecutionHostCallResult<ProjectHealthReport>> {
    return this.call(hostId, (client) => client.projectHealth(projectId));
  }

  async reconcileWorkspaces(
    hostId: ExecutionHostId,
  ): Promise<ExecutionHostCallResult<WorkspaceReconcileReport>> {
    return this.call(hostId, (client) => client.reconcileWorkspaces());
  }

  async cleanupWorkspace(
    hostId: ExecutionHostId,
    workspaceId: string,
    force: boolean,
  ): Promise<ExecutionHostCallResult<WorkspaceCleanupResult>> {
    return this.call(hostId, (client) => client.cleanupWorkspace(workspaceId, force));
  }

  /** Asking warms an idle remote host. */
  resolveEndpoint(hostId: ExecutionHostId): ResolvedDaemonEndpoint {
    if (hostId === "remote" && this.options.remoteSshAlias() !== null) {
      void this.options.warmRemote();
    }
    return currentEndpoint(this.options, hostId);
  }

  /** Asking is what brings an idle remote tunnel back up. */
  targets(): HostTarget[] {
    const targets: HostTarget[] = [
      {
        host: { id: "local", label: "Local", kind: "local" },
        active: this.options.activeHostId() === "local",
        status: null,
        endpoint: this.options.localDaemon(),
      },
    ];
    const alias = this.options.remoteSshAlias();
    if (alias === null) return targets;
    void this.options.warmRemote();
    const session = this.options.remoteSession();
    targets.push({
      host: { id: "remote", label: alias, kind: "ssh" },
      active: this.options.activeHostId() === "remote",
      status: session?.status ?? { phase: "disconnected", detail: null },
      endpoint: session?.endpoint ?? null,
    });
    return targets;
  }

  private client(endpoint: DaemonEndpoint): DaemonClient {
    return createDaemonClient({ ...endpoint, fetch: this.options.fetchImpl });
  }

  /** Runs one call on the owning host's daemon alone; an unreachable or refusing host answers with prose. */
  private async call<T>(
    hostId: ExecutionHostId,
    run: (client: DaemonClient) => Promise<T>,
  ): Promise<ExecutionHostCallResult<T>> {
    const target = await resolveCommandEndpoint(this.options, hostId);
    if ("message" in target) return { ok: false, message: target.message };
    try {
      return { ok: true, value: await run(this.client(target)) };
    } catch (error) {
      const refusal = hostCommandRefusal(
        error,
        hostId,
        "Call",
        this.options.log,
        (status) => `The ${hostId} daemon refused the request (HTTP ${status}).`,
      );
      return refusal === null
        ? { ok: false, message: `The ${hostId} daemon answered in an unknown format.` }
        : { ok: false, ...refusal };
    }
  }

  /** Unreachable, refused or invalid reads null (never a throw), so one dead host cannot blank a listing. */
  private async read<T>(
    endpoint: DaemonEndpoint,
    what: string,
    call: (client: DaemonClient) => Promise<T[]>,
  ): Promise<T[] | null> {
    try {
      return await call(this.client(endpoint));
    } catch (error) {
      if (error instanceof DaemonRequestError) return null;
      if (error instanceof DaemonTransportError) {
        this.options.log(`Could not list ${what} from ${endpoint.baseUrl}: ${String(error.cause)}`);
        return null;
      }
      this.options.log(`Host at ${endpoint.baseUrl} returned an invalid ${what} list`);
      return null;
    }
  }
}
