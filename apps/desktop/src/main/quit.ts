/** The processes the app owns and must stop before it quits; `DesktopRuntime` satisfies it. */
export interface QuittableRuntime {
  daemon: { running: boolean; stop(): Promise<void> };
  hosts: { shutdown(): Promise<void>; remoteSession: object | null };
}

interface QuitApplication {
  on(event: "before-quit", listener: (event: { preventDefault(): void }) => void): void;
  quit(): void;
}

interface QuitSignalSource {
  once(event: "SIGTERM", listener: () => void): void;
}

/** Decides whether a quit may proceed at all; `BackgroundMode` implements it. */
export interface QuitGate {
  allowQuit(): boolean;
  forceQuit(): void;
}

export interface QuitHandlers {
  gate: QuitGate;
  sequence: QuitSequence;
}

export function registerQuitHandlers(
  app: QuitApplication,
  signals: QuitSignalSource,
  handlers: () => QuitHandlers | null,
): void {
  signals.once("SIGTERM", () => {
    handlers()?.gate.forceQuit();
    app.quit();
  });
  app.on("before-quit", (event) => {
    const current = handlers();
    if (current === null) return;
    if (!current.gate.allowQuit()) {
      event.preventDefault();
      return;
    }
    if (current.sequence.begin(() => app.quit())) event.preventDefault();
  });
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
