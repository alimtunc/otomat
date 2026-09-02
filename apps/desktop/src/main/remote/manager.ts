import {
  sameRemoteHostStatus,
  type ExecutionHostId,
  type ExecutionHostOperationResult,
  type ExecutionHostSelectResult,
  type ExecutionHostSnapshot,
  type RemoteHostStatus,
} from "@otomat/domain";

import { STABLE_DEPLOYMENT, type RemoteDeployment } from "./bootstrap/scripts.js";
import { errorResult } from "./bootstrap/status.js";
import { safeSshAliases, validateSshAlias } from "./host/alias.js";
import { HostCatalog } from "./host/catalog.js";
import { HostSelection } from "./host/selection.js";
import { executionHostSnapshot } from "./host/snapshot.js";
import {
  RemoteHostSession,
  type RemoteSessionHandle,
  type RemoteSessionOptions,
} from "./session.js";
import { listSshConfigAliases } from "./ssh/config-aliases.js";
import { RemoteUpgradeCoordinator } from "./upgrade/coordinator.js";
import type { RemoteUpdateResult } from "./upgrade/daemon.js";

const SWITCH_IN_PROGRESS = "A host switch is in progress. Try again in a moment.";

export interface ExecutionHostManagerOptions {
  dataDir: string;
  log(message: string): void;
  localDaemonUrl(): string;
  onRemoteStatus(status: RemoteHostStatus): void;
  /** Fires whenever a session reaches `connected`, with the tunnel's local origin. */
  onRemoteConnected?(alias: string, url: string): void;
  applyRendererUrl(url: string): void;
  expectedBuild?: string | null;
  /** Daemon location and port this app targets on the host; the stable deployment when omitted. */
  deployment?: RemoteDeployment;
  /** GitHub `owner/repo` whose CI publishes the daemon bundles an update installs. */
  repo: string;
  createSession?: (options: RemoteSessionOptions) => RemoteSessionHandle;
  listAliases?: typeof listSshConfigAliases;
  fetchImpl?: typeof fetch;
}

// Switching is always explicit: a failed remote connection never falls back to the local daemon — the selection stays untouched and the failure is returned verbatim.
export class ExecutionHostManager {
  /** The per-host project catalog; callers read it directly rather than through forwarders. */
  readonly catalog: HostCatalog;
  private readonly selection: HostSelection;
  private session: RemoteSessionHandle | null = null;
  private switching = false;
  private lastPublished: RemoteHostStatus | null = null;
  private readonly upgrade: RemoteUpgradeCoordinator;

  constructor(private readonly options: ExecutionHostManagerOptions) {
    this.selection = new HostSelection(options.dataDir, options.log);
    this.catalog = new HostCatalog({
      localDaemonUrl: options.localDaemonUrl,
      activeHostId: () => this.activeHostId,
      remoteSshAlias: () => this.remoteSshAlias,
      remoteSession: () => this.session,
      warmRemote: () => this.ensureBackgroundRemote(),
      fetchImpl: options.fetchImpl ?? fetch,
      log: options.log,
    });
    this.upgrade = new RemoteUpgradeCoordinator({
      expectedBuild: options.expectedBuild ?? null,
      deployment: options.deployment ?? STABLE_DEPLOYMENT,
      repo: options.repo,
      alias: () => this.remoteSshAlias,
      session: () => this.session,
      onStatus: () => this.publishStatus(),
      log: options.log,
      fetchImpl: options.fetchImpl ?? fetch,
    });
  }

  get activeHostId(): ExecutionHostId {
    return this.selection.activeHostId;
  }

  get remoteSshAlias(): string | null {
    return this.selection.remoteSshAlias;
  }

  /** The live session, or null when this host has none yet — never a superseded one. */
  get remoteSession(): RemoteSessionHandle | null {
    return this.session;
  }

  /** One journey: the update owns the status while it runs, since its own restart drops the tunnel. */
  get remoteStatus(): RemoteHostStatus | null {
    return this.upgrade.status ?? this.session?.status ?? null;
  }

  snapshot(): ExecutionHostSnapshot {
    return executionHostSnapshot({
      activeId: this.activeHostId,
      alias: this.remoteSshAlias,
      status: this.remoteStatus,
      remoteBuild: this.session?.remoteBuild ?? null,
      expectedBuild: this.options.expectedBuild ?? null,
      updateError: this.upgrade.error,
    });
  }

  /** Retries the daemon update the host runs by itself; the same install, without its retry memory. */
  updateDaemon(): Promise<RemoteUpdateResult> {
    return this.upgrade.update();
  }

  listAliases(): string[] {
    return safeSshAliases(this.options.listAliases ?? listSshConfigAliases, this.options.log);
  }

  configureRemote(sshAlias: unknown): ExecutionHostOperationResult {
    if (this.switching) return { ok: false, message: SWITCH_IN_PROGRESS };
    const validated = validateSshAlias(sshAlias);
    if ("message" in validated) return { ok: false, message: validated.message };
    const { alias } = validated;
    if (this.session !== null && this.session.alias !== alias) {
      if (this.activeHostId === "remote") {
        return { ok: false, message: "Switch to a local project before changing the alias." };
      }
      this.detachSession("Stale remote session dispose failed");
    }
    const committed = this.selection.commit({ remote: { ssh_alias: alias } });
    if (!committed.ok) return committed;
    this.ensureBackgroundRemote();
    return committed;
  }

  async select(id: ExecutionHostId): Promise<ExecutionHostSelectResult> {
    if (this.switching) return errorResult("switch_in_progress");
    this.switching = true;
    try {
      return id === "remote" ? await this.selectRemote() : await this.selectLocal();
    } finally {
      this.switching = false;
    }
  }

  /** Reserves the tunnel port before the cockpit loads, so its CSP can name the origin a later switch targets. */
  async bootActivate(): Promise<string | null> {
    const alias = this.remoteSshAlias;
    if (alias === null) return null;
    this.session ??= this.createSession(alias);
    await this.session.ensureLocalPort();
    void this.session.connect(true);
    return this.activeHostId === "remote" ? this.session.url : null;
  }

  removeRemote(): ExecutionHostOperationResult {
    if (this.switching) return { ok: false, message: SWITCH_IN_PROGRESS };
    if (this.activeHostId === "remote") {
      return { ok: false, message: "Switch to a local project before removing the host." };
    }
    const committed = this.selection.commit({ remote: null, active: "local" });
    if (!committed.ok) return committed;
    this.detachSession("Removed host session dispose failed");
    return committed;
  }

  /** Drops the live session and disposes it behind the answer; a superseded handle never speaks again. */
  private detachSession(reason: string): void {
    const session = this.session;
    this.session = null;
    session?.dispose().catch((error: unknown) => this.options.log(`${reason}: ${String(error)}`));
  }

  async shutdown(): Promise<void> {
    this.upgrade.stop();
    const session = this.session;
    this.session = null;
    if (session !== null) await session.dispose();
  }

  private async selectRemote(): Promise<ExecutionHostSelectResult> {
    const alias = this.remoteSshAlias;
    if (alias === null) return errorResult("not_configured");
    if (this.session !== null && this.session.alias !== alias) {
      await this.session.dispose();
      this.session = null;
    }
    const session = (this.session ??= this.createSession(alias));
    const status = await session.connect(false);
    if (this.session !== session) return errorResult("switch_in_progress");
    if (status.phase !== "connected") return { ok: false, status };
    const url = session.url;
    if (url === null) return errorResult("tunnel_failed");
    const committed = this.selection.commit({ active: "remote" });
    if (!committed.ok) return committed;
    this.options.applyRendererUrl(url);
    return { ok: true, url };
  }

  /** The remote session survives a switch to local, so the switcher keeps listing that host. */
  private async selectLocal(): Promise<ExecutionHostSelectResult> {
    const url = this.options.localDaemonUrl();
    if (url === "") return errorResult("local_daemon_unavailable");
    const committed = this.selection.commit({ active: "local" });
    if (!committed.ok) return committed;
    this.options.applyRendererUrl(url);
    return { ok: true, url };
  }

  private ensureBackgroundRemote(): void {
    const alias = this.remoteSshAlias;
    if (alias === null) return;
    if (this.session === null) {
      this.session = this.createSession(alias);
      void this.session.connect(true);
      return;
    }
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
      onStatus: (status) => this.announce(alias, status),
    });
  }

  /** Callers store the handle before connecting; a superseded session never speaks for the host. */
  private announce(alias: string, status: RemoteHostStatus): void {
    this.publishStatus();
    const current = this.session !== null && this.session.alias === alias ? this.session : null;
    if (status.phase !== "connected" || current === null) return;
    if (current.url !== null) this.options.onRemoteConnected?.(alias, current.url);
    // Build verification is host lifecycle — it may restart the daemon and reconnect the
    // tunnel — so it hangs off the connected transition, never off a catalog read.
    this.upgrade.observe();
  }

  private publishStatus(): void {
    const status = this.remoteStatus;
    if (status === null || sameRemoteHostStatus(status, this.lastPublished)) return;
    this.lastPublished = status;
    this.options.onRemoteStatus(status);
  }
}
