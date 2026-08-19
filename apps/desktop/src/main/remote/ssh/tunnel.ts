import { spawn, type SpawnOptions } from "node:child_process";

import { terminateChild, type TerminatableChild } from "#shared/terminate";

import { SSH_BATCH_ARGS } from "./script.js";

/** What the tunnel drives on a spawned ssh child: termination plus stderr and lifecycle events. */
export interface TunnelChild extends TerminatableChild {
  readonly stderr: { on(event: "data", listener: (chunk: Buffer) => void): void } | null;
  on(event: "error", listener: (error: Error) => void): void;
  on(event: "close", listener: (code: number | null) => void): void;
}

const STDERR_TAIL_LIMIT = 600;
const STOP_GRACE_MS = 2_000;

export interface TunnelExitInfo {
  code: number | null;
  stderrTail: string;
  /** True when the exit was caused by `stop()`, false when the tunnel dropped on its own. */
  expected: boolean;
}

export interface SshTunnelOptions {
  alias: string;
  localPort: number;
  remotePort: number;
  onExit(info: TunnelExitInfo): void;
  spawnImpl?: (command: string, args: readonly string[], options: SpawnOptions) => TunnelChild;
}

export function tunnelArgs(alias: string, localPort: number, remotePort: number): string[] {
  return [
    "-N",
    "-T",
    ...SSH_BATCH_ARGS,
    "-o",
    "ExitOnForwardFailure=yes",
    "-o",
    "ServerAliveInterval=5",
    "-o",
    "ServerAliveCountMax=3",
    "-L",
    `127.0.0.1:${localPort}:127.0.0.1:${remotePort}`,
    alias,
  ];
}

export interface TunnelHandle {
  readonly running: boolean;
  start(): void;
  stop(): Promise<void>;
}

/** One `ssh -N -L` child forwarding a local loopback port to the remote daemon's loopback port. */
export class SshTunnel implements TunnelHandle {
  private child: TunnelChild | null = null;
  private stderrTail = "";
  private stopping = false;

  constructor(private readonly options: SshTunnelOptions) {}

  get running(): boolean {
    return this.child !== null;
  }

  start(): void {
    if (this.child !== null) throw new Error("Tunnel already started");
    const doSpawn: NonNullable<SshTunnelOptions["spawnImpl"]> = this.options.spawnImpl ?? spawn;
    const child = doSpawn(
      "ssh",
      tunnelArgs(this.options.alias, this.options.localPort, this.options.remotePort),
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    this.stderrTail = "";
    this.stopping = false;
    child.stderr?.on("data", (chunk: Buffer) => {
      this.stderrTail = `${this.stderrTail}${chunk.toString("utf8")}`.slice(-STDERR_TAIL_LIMIT);
    });
    child.on("error", (error) => {
      if (this.child !== child) return;
      this.child = null;
      this.options.onExit({
        code: null,
        stderrTail: `${this.stderrTail}\n${String(error)}`.trim().slice(-STDERR_TAIL_LIMIT),
        expected: this.stopping,
      });
    });
    child.on("close", (code) => {
      if (this.child !== child) return;
      this.child = null;
      this.options.onExit({ code, stderrTail: this.stderrTail.trim(), expected: this.stopping });
    });
    this.child = child;
  }

  async stop(): Promise<void> {
    const child = this.child;
    if (child === null) return;
    this.stopping = true;
    await terminateChild(child, STOP_GRACE_MS);
  }
}
