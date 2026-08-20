/** The processes the app owns and must stop before it quits; `DesktopRuntime` satisfies it. */
export interface QuittableRuntime {
  daemon: { running: boolean; stop(): Promise<void> };
  hosts: { shutdown(): Promise<void>; remoteSession: object | null };
}

/** The only quit request an app gets may be one SIGTERM, so a failed shutdown still releases it. */
export class QuitSequence {
  private phase: "idle" | "stopping" | "stopped" = "idle";

  constructor(
    private readonly runtime: () => QuittableRuntime | null,
    private readonly log: (message: string) => void,
  ) {}

  /** True when the quit must wait: this shutdown owns it and calls `done` once it settles. */
  begin(done: () => void): boolean {
    if (this.phase !== "idle") return this.phase === "stopping";
    const runtime = this.runtime();
    if (runtime === null) return false;
    if (!runtime.daemon.running && runtime.hosts.remoteSession === null) return false;
    this.phase = "stopping";
    const release = (): void => {
      this.phase = "stopped";
      done();
    };
    void this.stopOwnedProcesses(runtime).then(release, release);
    return true;
  }

  private async stopOwnedProcesses(runtime: QuittableRuntime): Promise<void> {
    this.log("Quit phase: stopping the remote hosts.");
    try {
      await runtime.hosts.shutdown();
    } catch (error) {
      this.log(`Tunnel stop failed during quit: ${String(error)}`);
    }
    if (runtime.daemon.running) {
      this.log("Quit phase: stopping the local daemon.");
      try {
        await runtime.daemon.stop();
      } catch (error) {
        this.log(`Daemon stop failed during quit: ${String(error)}`);
      }
    }
    this.log("Quit phase: shutdown complete.");
  }
}
