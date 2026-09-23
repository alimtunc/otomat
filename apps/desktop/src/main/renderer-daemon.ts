import type { DaemonEndpoint } from "@otomat/client";

import { DAEMON_TOKEN_CHANGED_CHANNEL } from "#shared/ipc-channels";

import type { IpcState } from "./ipc.js";

const NO_DAEMON: DaemonEndpoint = { baseUrl: "", token: "" };

/** A loaded cockpit follows a new token live; its origin only changes through a reload. */
export class RendererDaemon {
  constructor(
    private readonly state: Pick<IpcState, "daemonUrl" | "daemonToken">,
    private readonly csp: { allows(url: string): boolean },
    private readonly cockpit: { send(channel: string, payload: unknown): void; reload(): void },
  ) {}

  follow(endpoint: DaemonEndpoint): void {
    this.point(endpoint);
    if (!this.csp.allows(endpoint.baseUrl)) this.cockpit.reload();
  }

  point(endpoint: DaemonEndpoint = NO_DAEMON): void {
    this.state.daemonUrl = endpoint.baseUrl;
    if (this.state.daemonToken === endpoint.token) return;
    this.state.daemonToken = endpoint.token;
    this.cockpit.send(DAEMON_TOKEN_CHANGED_CHANNEL, endpoint.token);
  }
}
