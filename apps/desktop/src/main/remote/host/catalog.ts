import { createDaemonClient, DaemonRequestError, DaemonTransportError } from "@otomat/client";
import {
  repositoryDeletionErrorSchema,
  repositoryRegistrationErrorSchema,
  type ExecutionHostDescriptor,
  type ExecutionHostId,
  type ExecutionHostOperationResult,
  type ExecutionHostProjectsEntry,
  type ExecutionHostRegisterProjectResult,
  type ExecutionHostRepositoriesEntry,
  type RemoteHostStatus,
} from "@otomat/domain";

import type { RemoteSessionHandle } from "../session.js";

/** Where a host's daemon answers, or why it cannot be reached. */
export type ResolvedDaemonUrl = { url: string } | { message: string };

type DaemonClient = ReturnType<typeof createDaemonClient>;

/** One configured host with the URL its own daemon answers on, or null while it cannot be reached. */
export interface HostTarget {
  host: ExecutionHostDescriptor;
  active: boolean;
  status: RemoteHostStatus | null;
  url: string | null;
}

export interface HostCatalogOptions {
  localDaemonUrl(): string;
  activeHostId(): ExecutionHostId;
  remoteSshAlias(): string | null;
  remoteSession(): RemoteSessionHandle | null;
  warmRemote(): void;
  fetchImpl: typeof fetch;
  log(message: string): void;
}

export class HostCatalog {
  constructor(private readonly options: HostCatalogOptions) {}

  async listProjects(): Promise<ExecutionHostProjectsEntry[]> {
    return Promise.all(
      this.targets().map(async ({ url, ...entry }) => ({
        ...entry,
        projects: url === null ? null : await this.read(url, "projects", (c) => c.listProjects()),
      })),
    );
  }

  async listRepositories(): Promise<ExecutionHostRepositoriesEntry[]> {
    return Promise.all(
      this.targets().map(async ({ url, ...entry }) => ({
        ...entry,
        repositories:
          url === null ? null : await this.read(url, "repositories", (c) => c.listRepositories()),
      })),
    );
  }

  /** Failures come back as prose in the result, never as a throw. */
  async registerProject(
    hostId: ExecutionHostId,
    path: string,
  ): Promise<ExecutionHostRegisterProjectResult> {
    if (path.trim() === "") return { ok: false, message: "Enter a repository path on the host." };
    const target = this.resolveBaseUrl(hostId);
    if ("message" in target) return { ok: false, message: target.message };
    try {
      const created = await this.client(target.url).registerRepository({ path: path.trim() });
      return { ok: true, project: created.project };
    } catch (error) {
      if (error instanceof DaemonRequestError) {
        const refusal = repositoryRegistrationErrorSchema.safeParse(error.body);
        return {
          ok: false,
          message: refusal.success
            ? refusal.data.message
            : `The daemon refused the registration (HTTP ${error.status}).`,
        };
      }
      if (error instanceof DaemonTransportError) {
        this.options.log(`Register on ${hostId} failed: ${String(error.cause)}`);
        return {
          ok: false,
          message: `Could not reach the ${hostId} daemon: ${String(error.cause)}`,
        };
      }
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
    const target = this.resolveBaseUrl(hostId);
    if ("message" in target) return { ok: false, message: target.message };
    try {
      await this.client(target.url).deleteRepository(repositoryId);
      return { ok: true };
    } catch (error) {
      if (error instanceof DaemonRequestError) {
        const refusal = repositoryDeletionErrorSchema.safeParse(error.body);
        return {
          ok: false,
          message: refusal.success
            ? refusal.data.message
            : `The daemon refused the deletion (HTTP ${error.status}).`,
        };
      }
      if (error instanceof DaemonTransportError) {
        this.options.log(`Delete on ${hostId} failed: ${String(error.cause)}`);
        return {
          ok: false,
          message: `Could not reach the ${hostId} daemon: ${String(error.cause)}`,
        };
      }
      throw error;
    }
  }

  /** Asking warms an idle remote host. */
  resolveBaseUrl(hostId: ExecutionHostId): ResolvedDaemonUrl {
    if (hostId === "local") {
      const url = this.options.localDaemonUrl();
      return url === "" ? { message: "The local daemon is not running yet." } : { url };
    }
    if (this.options.remoteSshAlias() === null) {
      return { message: "No remote host is configured." };
    }
    this.options.warmRemote();
    const session = this.options.remoteSession();
    if (session === null || session.status.phase !== "connected" || session.url === null) {
      return { message: "The remote host is not connected yet. Try again once its tunnel is up." };
    }
    return { url: session.url };
  }

  /** Asking is what brings an idle remote tunnel back up. */
  targets(): HostTarget[] {
    const localUrl = this.options.localDaemonUrl();
    const targets: HostTarget[] = [
      {
        host: { id: "local", label: "Local", kind: "local" },
        active: this.options.activeHostId() === "local",
        status: null,
        url: localUrl === "" ? null : localUrl,
      },
    ];
    const alias = this.options.remoteSshAlias();
    if (alias === null) return targets;
    this.options.warmRemote();
    const session = this.options.remoteSession();
    targets.push({
      host: { id: "remote", label: alias, kind: "ssh" },
      active: this.options.activeHostId() === "remote",
      status: session?.status ?? { phase: "disconnected", detail: null },
      url: session !== null && session.status.phase === "connected" ? session.url : null,
    });
    return targets;
  }

  private client(baseUrl: string): DaemonClient {
    return createDaemonClient({ baseUrl, fetch: this.options.fetchImpl });
  }

  /** Unreachable, refused or invalid reads null (never a throw), so one dead host cannot blank a listing. */
  private async read<T>(
    baseUrl: string,
    what: string,
    call: (client: DaemonClient) => Promise<T[]>,
  ): Promise<T[] | null> {
    try {
      return await call(this.client(baseUrl));
    } catch (error) {
      if (error instanceof DaemonRequestError) return null;
      if (error instanceof DaemonTransportError) {
        this.options.log(`Could not list ${what} from ${baseUrl}: ${String(error.cause)}`);
        return null;
      }
      this.options.log(`Host at ${baseUrl} returned an invalid ${what} list`);
      return null;
    }
  }
}
