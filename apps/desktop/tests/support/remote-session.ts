import type { RemoteHostStatus } from "@otomat/domain";

import type { RemoteSessionHandle } from "#main/remote/session";

/** What one `refreshDaemon()` settles on: the phase it reports, and the build health then named. */
export interface FakeRemoteRefresh {
  status: RemoteHostStatus;
  build?: string | null;
}

export interface FakeRemoteSessionOptions {
  status?: RemoteHostStatus;
  url?: string | null;
  build?: string | null;
  /** Called per restart, so a test can make the upgraded daemon come back — or not. */
  onRefresh?(attempt: number): FakeRemoteRefresh;
}

/** A connected remote session without ssh: the upgrade only needs its status, url and restart. */
export class FakeRemoteSession implements RemoteSessionHandle {
  refreshes = 0;
  private currentStatus: RemoteHostStatus;
  private currentBuild: string | null;

  constructor(private readonly options: FakeRemoteSessionOptions = {}) {
    this.currentStatus = options.status ?? { phase: "connected", detail: null };
    this.currentBuild = options.build ?? null;
  }

  get alias(): string {
    return "otomat-vps";
  }

  get status(): RemoteHostStatus {
    return this.currentStatus;
  }

  get url(): string | null {
    return this.options.url === undefined ? "http://127.0.0.1:49200" : this.options.url;
  }

  get remoteBuild(): string | null {
    return this.currentBuild;
  }

  ensureLocalPort(): Promise<number> {
    return Promise.resolve(49_200);
  }

  connect(): Promise<RemoteHostStatus> {
    return Promise.resolve(this.currentStatus);
  }

  refreshDaemon(): Promise<RemoteHostStatus> {
    this.refreshes += 1;
    const next = this.options.onRefresh?.(this.refreshes);
    if (next !== undefined) {
      this.currentStatus = next.status;
      this.currentBuild = next.build ?? null;
    }
    return Promise.resolve(this.currentStatus);
  }

  dispose(): Promise<void> {
    return Promise.resolve();
  }
}
