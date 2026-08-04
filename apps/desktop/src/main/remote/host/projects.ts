import {
  projectContractSchema,
  registerRepositoryResponseSchema,
  repositoryRegistrationErrorSchema,
  type ExecutionHostId,
  type ExecutionHostProjectsEntry,
  type ExecutionHostRegisterProjectResult,
  type ProjectContract,
} from "@otomat/domain";

import type { RemoteSessionHandle } from "../session.js";
import { StaleDaemonRefresher } from "../stale-daemon.js";

/** One host's project catalog over plain HTTP; unreachable or invalid reads null (logged), never an error. */
async function fetchProjectCatalog(
  baseUrl: string,
  fetchImpl: typeof fetch,
  log: (message: string) => void,
): Promise<ProjectContract[] | null> {
  try {
    const response = await fetchImpl(`${baseUrl}/api/projects`);
    if (!response.ok) return null;
    const parsed = projectContractSchema.array().safeParse(await response.json());
    if (!parsed.success) {
      log(`Host at ${baseUrl} returned an invalid project list`);
      return null;
    }
    return parsed.data;
  } catch (error) {
    log(`Could not list projects from ${baseUrl}: ${String(error)}`);
    return null;
  }
}

export interface HostCatalogOptions {
  localDaemonUrl(): string;
  activeHostId(): ExecutionHostId;
  remoteSshAlias(): string | null;
  remoteSession(): RemoteSessionHandle | null;
  warmRemote(): void;
  expectedBuild: string | null;
  fetchImpl: typeof fetch;
  log(message: string): void;
}

export class HostCatalog {
  private readonly staleRefresher: StaleDaemonRefresher;

  constructor(private readonly options: HostCatalogOptions) {
    this.staleRefresher = new StaleDaemonRefresher({
      expectedBuild: options.expectedBuild,
      fetchImpl: options.fetchImpl,
      log: options.log,
    });
  }

  async listProjects(): Promise<ExecutionHostProjectsEntry[]> {
    const localUrl = this.options.localDaemonUrl();
    const entries: ExecutionHostProjectsEntry[] = [
      {
        host: { id: "local", label: "Local", kind: "local" },
        active: this.options.activeHostId() === "local",
        status: null,
        projects: localUrl === "" ? null : await this.fetchCatalog(localUrl),
      },
    ];
    const alias = this.options.remoteSshAlias();
    if (alias !== null) {
      this.options.warmRemote();
      const session = this.options.remoteSession();
      const url = session !== null && session.status.phase === "connected" ? session.url : null;
      entries.push({
        host: { id: "remote", label: alias, kind: "ssh" },
        active: this.options.activeHostId() === "remote",
        status: session?.status ?? { phase: "disconnected", detail: null },
        projects: url === null ? null : await this.fetchCatalog(url),
      });
      // Piggybacks on the switcher's poll: a redeployed-but-stale daemon restarts itself once idle.
      void this.staleRefresher.maybeRefresh(session);
    }
    return entries;
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
      const response = await this.options.fetchImpl(`${target.url}/api/repositories`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: path.trim() }),
      });
      const payload: unknown = await response.json();
      if (response.status === 201) {
        const created = registerRepositoryResponseSchema.safeParse(payload);
        if (!created.success) {
          // The project exists on the daemon; only this response was unreadable (likely version skew).
          return {
            ok: false,
            message:
              "The daemon registered the repository but answered in an unknown format; refresh the project list.",
          };
        }
        return { ok: true, project: created.data.project };
      }
      const refusal = repositoryRegistrationErrorSchema.safeParse(payload);
      return {
        ok: false,
        message: refusal.success
          ? refusal.data.message
          : `The daemon refused the registration (HTTP ${response.status}).`,
      };
    } catch (error) {
      this.options.log(`Register on ${hostId} failed: ${String(error)}`);
      return { ok: false, message: `Could not reach the ${hostId} daemon: ${String(error)}` };
    }
  }

  private resolveBaseUrl(hostId: ExecutionHostId): { url: string } | { message: string } {
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

  private fetchCatalog(baseUrl: string): Promise<ProjectContract[] | null> {
    return fetchProjectCatalog(baseUrl, this.options.fetchImpl, this.options.log);
  }
}
