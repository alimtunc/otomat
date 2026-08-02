import type {
  ExecutionHostDescriptor,
  ExecutionHostId,
  ExecutionHostOperationResult,
  ExecutionHostSnapshot,
  RemoteHostErrorCode,
  RemoteHostStatus,
} from "@otomat/domain";

import {
  DEFAULT_EXECUTION_HOSTS_CONFIG,
  readExecutionHostsConfig,
  writeExecutionHostsConfig,
  type ExecutionHostsConfig,
} from "./hosts-config.js";
import {
  RemoteHostSession,
  type RemoteSessionHandle,
  type RemoteSessionOptions,
} from "./session.js";
import { listSshConfigAliases } from "./ssh-config-aliases.js";

function errorResult(code: RemoteHostErrorCode): ExecutionHostOperationResult {
  return { ok: false, status: { phase: "error", code, detail: null } };
}

export interface ExecutionHostManagerOptions {
  dataDir: string;
  log(message: string): void;
  localDaemonUrl(): string;
  onRemoteStatus(status: RemoteHostStatus): void;
  /** Points the renderer at a new daemon origin and reloads it. */
  applyRendererUrl(url: string): void;
  createSession?: (options: RemoteSessionOptions) => RemoteSessionHandle;
  listAliases?: typeof listSshConfigAliases;
}

// Switching is always explicit: a failed remote connection never falls back to the local daemon — the selection stays untouched and the failure is returned verbatim.
export class ExecutionHostManager {
  private config: ExecutionHostsConfig;
  private session: RemoteSessionHandle | null = null;
  private switching = false;

  constructor(private readonly options: ExecutionHostManagerOptions) {
    this.config = this.readConfig();
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
    if (typeof sshAlias !== "string" || sshAlias.trim() === "") {
      return { ok: false, message: "Enter an SSH alias from ~/.ssh/config." };
    }
    const alias = sshAlias.trim();
    if (/\s/.test(alias) || alias.startsWith("-")) {
      return { ok: false, message: "The SSH alias must be a single word." };
    }
    if (this.session !== null && this.session.alias !== alias) {
      if (this.activeHostId === "remote") {
        return { ok: false, message: "Switch to the local host before changing the remote alias." };
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

  /** Boot with the remote host active: reserve the tunnel's local port so the renderer URL is stable from the first paint, then connect in the background (self-healing retry). */
  async bootActivate(): Promise<string | null> {
    const alias = this.remoteSshAlias;
    if (this.activeHostId !== "remote" || alias === null) return null;
    this.session ??= this.createSession(alias);
    await this.session.ensureLocalPort();
    void this.session.connect(true);
    return this.session.url;
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
    this.session ??= this.createSession(alias);
    const status = await this.session.connect(false);
    if (status.phase !== "connected") return { ok: false, status };
    const url = this.session.url;
    if (url === null) return errorResult("tunnel_failed");
    this.config = { ...this.config, active: "remote" };
    this.persist();
    this.options.applyRendererUrl(url);
    return { ok: true };
  }

  private async selectLocal(): Promise<ExecutionHostOperationResult> {
    const url = this.options.localDaemonUrl();
    if (url === "") return errorResult("local_daemon_unavailable");
    if (this.session !== null) {
      await this.session.dispose();
      this.session = null;
    }
    this.config = { ...this.config, active: "local" };
    this.persist();
    this.options.applyRendererUrl(url);
    return { ok: true };
  }

  private createSession(alias: string): RemoteSessionHandle {
    const create =
      this.options.createSession ??
      ((options: RemoteSessionOptions) => new RemoteHostSession(options));
    return create({
      alias,
      log: this.options.log,
      onStatus: (status) => this.options.onRemoteStatus(status),
    });
  }

  private readConfig(): ExecutionHostsConfig {
    try {
      return readExecutionHostsConfig(this.options.dataDir);
    } catch (error) {
      this.options.log(`Execution-hosts config unreadable, using defaults: ${String(error)}`);
      return DEFAULT_EXECUTION_HOSTS_CONFIG;
    }
  }

  private persist(): void {
    try {
      writeExecutionHostsConfig(this.options.dataDir, this.config);
    } catch (error) {
      this.options.log(`Could not persist the execution-hosts config: ${String(error)}`);
    }
  }
}
