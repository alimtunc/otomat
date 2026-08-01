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

const ERROR_MESSAGES: Record<RemoteHostErrorCode, string> = {
  not_configured: "Configure the remote host's SSH alias first.",
  ssh_unreachable: "Could not reach the host over SSH.",
  daemon_missing: "The Otomat daemon is not installed on the host.",
  node_missing: "Node.js was not found on the host.",
  node_too_old: "The host's Node.js is older than version 22.",
  daemon_start_failed: "The remote daemon did not start.",
  tunnel_failed: "The SSH tunnel closed unexpectedly.",
  health_failed: "The remote daemon never answered its health check through the tunnel.",
  switch_in_progress: "A host switch is already in progress.",
  local_daemon_unavailable: "The local daemon is not running.",
};

function describeStatus(status: RemoteHostStatus): string {
  const base =
    status.phase === "error" ? ERROR_MESSAGES[status.code] : `Connection is ${status.phase}.`;
  return status.detail === null ? base : `${base} (${status.detail})`;
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

/**
 * Owns the persisted host selection and the single remote session. Switching is
 * always explicit: a failed remote connection never falls back to the local
 * daemon — the selection stays untouched and the failure is returned verbatim.
 */
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
      void stale.dispose();
    }
    this.config = { ...this.config, remote: { ssh_alias: alias } };
    this.persist();
    return { ok: true };
  }

  async select(id: ExecutionHostId): Promise<ExecutionHostOperationResult> {
    if (this.switching) return { ok: false, message: ERROR_MESSAGES.switch_in_progress };
    this.switching = true;
    try {
      return id === "remote" ? await this.selectRemote() : await this.selectLocal();
    } finally {
      this.switching = false;
    }
  }

  /**
   * At boot with the remote host active: reserve the tunnel's local port so the
   * renderer URL is stable from the first paint, then connect in the background
   * (self-healing retry). Returns the renderer URL, or null when local is active.
   */
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
    if (alias === null) return { ok: false, message: ERROR_MESSAGES.not_configured };
    if (this.session !== null && this.session.alias !== alias) {
      await this.session.dispose();
      this.session = null;
    }
    this.session ??= this.createSession(alias);
    const status = await this.session.connect(false);
    if (status.phase !== "connected") return { ok: false, message: describeStatus(status) };
    const url = this.session.url;
    if (url === null) return { ok: false, message: ERROR_MESSAGES.tunnel_failed };
    this.config = { ...this.config, active: "remote" };
    this.persist();
    this.options.applyRendererUrl(url);
    return { ok: true };
  }

  private async selectLocal(): Promise<ExecutionHostOperationResult> {
    const url = this.options.localDaemonUrl();
    if (url === "") return { ok: false, message: ERROR_MESSAGES.local_daemon_unavailable };
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
