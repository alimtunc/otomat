import { authorizedFetch, type DaemonCredentials } from "#shared/daemon-credentials";

import { RendererCsp } from "./csp.js";
import type { DesktopRuntime } from "./runtime.js";

/** The daemons this app is linked to right now — its own and the tunnelled remote: their origins for the renderer's CSP, their bearers for every request. */
export class DaemonLink {
  readonly localUrl = (): string => this.runtime()?.daemon.credential?.url ?? "";
  readonly csp = new RendererCsp(() => [
    this.localUrl(),
    this.runtime()?.hosts.remoteSession?.url ?? null,
  ]);
  readonly credentials: DaemonCredentials = () => [
    this.runtime()?.daemon.credential ?? null,
    this.runtime()?.hosts.remoteSession?.credential ?? null,
  ];
  readonly fetch = authorizedFetch(this.credentials);

  constructor(private readonly runtime: () => DesktopRuntime | null) {}
}
