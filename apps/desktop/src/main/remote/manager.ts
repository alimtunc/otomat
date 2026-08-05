import type {
  ExecutionHostDescriptor,
  ExecutionHostId,
  ExecutionHostOperationResult,
  ExecutionHostProjectsEntry,
  ExecutionHostRegisterProjectResult,
  ExecutionHostSnapshot,
  RemoteHostErrorCode,
  RemoteHostStatus,
} from "@otomat/domain";

import { STABLE_DEPLOYMENT, type RemoteDeployment } from "./bootstrap/scripts.js";
import {
  readExecutionHostsConfigSafe,
  writeExecutionHostsConfigSafe,
  type ExecutionHostsConfig,
} from "./host/config.js";
import { HostCatalog } from "./host/projects.js";
import {
  RemoteHostSession,
  type RemoteSessionHandle,
  type RemoteSessionOptions,
} from "./session.js";
import { listSshConfigAliases } from "./ssh/config-aliases.js";

function errorResult(code: RemoteHostErrorCode): ExecutionHostOperationResult {
  return { ok: false, status: { phase: "error", code, detail: null } };
}

export interface ExecutionHostManagerOptions {
  dataDir: string;
  log(message: string): void;
  localDaemonUrl(): string;
  onRemoteStatus(status: RemoteHostStatus): void;
  applyRendererUrl(url: string): void;
  expectedBuild?: string | null;
  /** Daemon location and port this app targets on the host; the stable deployment when omitted. */
  deployment?: RemoteDeployment;
  createSession?: (options: RemoteSessionOptions) => RemoteSessionHandle;
  listAliases?: typeof listSshConfigAliases;
  fetchImpl?: typeof fetch;
}

// Switching is always explicit: a failed remote connection never falls back to the local daemon — the selection stays untouched and the failure is returned verbatim.
export class ExecutionHostManager {
  private config: ExecutionHostsConfig;
  private session: RemoteSessionHandle | null = null;
  private switching = false;
  private readonly catalog: HostCatalog;

  constructor(private readonly options: ExecutionHostManagerOptions) {
    this.config = readExecutionHostsConfigSafe(options.dataDir, options.log);
    this.catalog = new HostCatalog({
      localDaemonUrl: options.localDaemonUrl,
      activeHostId: () => this.activeHostId,
      remoteSshAlias: () => this.remoteSshAlias,
      remoteSession: () => this.session,
      warmRemote: () => this.ensureBackgroundRemote(),
      expectedBuild: options.expectedBuild ?? null,
      fetchImpl: options.fetchImpl ?? fetch,
      log: options.log,
    });
  }

  get activeHostId(): ExecutionHostId {
    return this.config.active === "remote" && this.config.remote !== null ? "remote" : "local";
  }

  get remoteSshAlias(): string | null {
    return this.config.remote?.ssh_alias ?? null;
  }

  get hasActiveSession(): boolean {
    return this.session !== null;
  }

  snapshot(): ExecutionHostSnapshot {
    const alias = this.remoteSshAlias;
    const hosts: ExecutionHostDescriptor[] = [{ id: "local", label: "Local", kind: "local" }];
    if (alias !== null) hosts.push({ id: "remote", label: alias, kind: "ssh" });
    return {
      hosts,
      active_id: this.activeHostId,
      remote_ssh_alias: alias,
      remote_status: this.session?.status ?? null,
      remote_build: this.session?.remoteBuild ?? null,
      expected_build: this.options.expectedBuild ?? null,
    };
  }

  listAliases(): string[] {
    try {
      return (this.options.listAliases ?? listSshConfigAliases)();
    } catch (error) {
      this.options.log(`Could not read ~/.ssh/config aliases: ${String(error)}`);
      return [];
    }
  }

  configureRemote(sshAlias: unknown): ExecutionHostOperationResult {
    if (this.switching) {
      return { ok: false, message: "A host switch is in progress. Try again in a moment." };
    }
    if (typeof sshAlias !== "string" || sshAlias.trim() === "") {
      return { ok: false, message: "Enter an SSH alias from ~/.ssh/config." };
    }
    const alias = sshAlias.trim();
    if (/\s/.test(alias) || alias.startsWith("-")) {
      return { ok: false, message: "The SSH alias must be a single word." };
    }
    if (this.session !== null && this.session.alias !== alias) {
      if (this.activeHostId === "remote") {
        return { ok: false, message: "Switch to a local project before changing the alias." };
      }
      const stale = this.session;
      this.session = null;
      stale
        .dispose()
        .catch((error: unknown) =>
          this.options.log(`Stale remote session dispose failed: ${String(error)}`),
        );
    }
    this.config = { ...this.config, remote: { ssh_alias: alias } };
    this.persist();
    this.ensureBackgroundRemote();
    return { ok: true };
  }

  async select(id: ExecutionHostId): Promise<ExecutionHostOperationResult> {
    if (this.switching) return errorResult("switch_in_progress");
    this.switching = true;
    try {
      return id === "remote" ? await this.selectRemote() : await this.selectLocal();
    } finally {
      this.switching = false;
    }
  }

  /** Reserves the tunnel port first so the renderer URL is stable, then connects in the background. */
  async bootActivate(): Promise<string | null> {
    const alias = this.remoteSshAlias;
    if (alias === null) return null;
    if (this.activeHostId !== "remote") {
      this.ensureBackgroundRemote();
      return null;
    }
    this.session ??= this.createSession(alias);
    await this.session.ensureLocalPort();
    void this.session.connect(true);
    return this.session.url;
  }

  listProjects(): Promise<ExecutionHostProjectsEntry[]> {
    return this.catalog.listProjects();
  }

  registerProject(
    hostId: ExecutionHostId,
    path: string,
  ): Promise<ExecutionHostRegisterProjectResult> {
    return this.catalog.registerProject(hostId, path);
  }

  removeRemote(): ExecutionHostOperationResult {
    if (this.switching) {
      return { ok: false, message: "A host switch is in progress. Try again in a moment." };
    }
    if (this.activeHostId === "remote") {
      return { ok: false, message: "Switch to a local project before removing the host." };
    }
    const session = this.session;
    this.session = null;
    if (session !== null) {
      session
        .dispose()
        .catch((error: unknown) =>
          this.options.log(`Removed host session dispose failed: ${String(error)}`),
        );
    }
    this.config = { ...this.config, remote: null, active: "local" };
    this.persist();
    return { ok: true };
  }

  async shutdown(): Promise<void> {
    const session = this.session;
    this.session = null;
    if (session !== null) await session.dispose();
  }

  private async selectRemote(): Promise<ExecutionHostOperationResult> {
    const alias = this.remoteSshAlias;
    if (alias === null) return errorResult("not_configured");
    if (this.session !== null && this.session.alias !== alias) {
      await this.session.dispose();
      this.session = null;
    }
    const session = (this.session ??= this.createSession(alias));
    const status = await session.connect(false);
    // The session field can only have moved under us via shutdown; never point the renderer at it.
    if (this.session !== session) return errorResult("switch_in_progress");
    if (status.phase !== "connected") return { ok: false, status };
    const url = session.url;
    if (url === null) return errorResult("tunnel_failed");
    this.config = { ...this.config, active: "remote" };
    this.persist();
    this.options.applyRendererUrl(url);
    return { ok: true };
  }

  /** The remote session survives a switch to local, so the switcher keeps listing that host. */
  private async selectLocal(): Promise<ExecutionHostOperationResult> {
    const url = this.options.localDaemonUrl();
    if (url === "") return errorResult("local_daemon_unavailable");
    this.config = { ...this.config, active: "local" };
    this.persist();
    this.options.applyRendererUrl(url);
    return { ok: true };
  }

  private ensureBackgroundRemote(): void {
    const alias = this.remoteSshAlias;
    if (alias === null) return;
    if (this.session === null) {
      this.session = this.createSession(alias);
      void this.session.connect(true);
      return;
    }
    // A failed explicit switch settles the session on `error` with its retry loop canceled;
    // the next warm-up re-arms it so the host keeps healing in the background.
    if (this.session.status.phase === "error") void this.session.connect(true);
  }

  private createSession(alias: string): RemoteSessionHandle {
    const create =
      this.options.createSession ??
      ((options: RemoteSessionOptions) => new RemoteHostSession(options));
    return create({
      alias,
      deployment: this.options.deployment ?? STABLE_DEPLOYMENT,
      log: this.options.log,
      onStatus: (status) => this.options.onRemoteStatus(status),
    });
  }

  private persist(): void {
    writeExecutionHostsConfigSafe(this.options.dataDir, this.config, this.options.log);
  }
}
