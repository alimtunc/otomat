import type { CloseChoice } from "./prompts.js";
import type { LocalWorkReading } from "./read-work.js";
import type { BackgroundTrayActions } from "./tray.js";
import { hasLiveWork, type LocalWorkSummary } from "./work-summary.js";

const REFRESH_INTERVAL_MS = 5_000;

/** The menu-bar item this mode drives; `BackgroundTray` implements it. */
export interface BackgroundTrayPort {
  render(summary: LocalWorkSummary | null): void;
  destroy(): void;
}

export interface BackgroundModeOptions {
  readWork(): Promise<LocalWorkReading>;
  askCloseChoice(summary: LocalWorkSummary | null): Promise<CloseChoice>;
  confirmQuit(summary: LocalWorkSummary | null): Promise<boolean>;
  createTray(actions: BackgroundTrayActions): BackgroundTrayPort;
  hideWindow(): void;
  openWindow(): void;
  quit(): void;
  log(message: string): void;
}

export class BackgroundMode {
  private tray: BackgroundTrayPort | null = null;
  private refresh: ReturnType<typeof setInterval> | null = null;
  private pending: "close" | "quit" | null = null;
  private quitRequested = false;
  private quitting = false;

  constructor(private readonly options: BackgroundModeOptions) {}

  handleWindowClose(): boolean {
    if (this.quitting) return false;
    if (this.pending === null) this.start("close");
    return true;
  }

  allowQuit(): boolean {
    if (this.quitting) return true;
    if (this.pending === null) this.start("quit");
    else if (this.pending === "close") this.quitRequested = true;
    return false;
  }

  /** The OS is taking the process down: no dialog can hold it, so none is shown. */
  forceQuit(): void {
    this.quitting = true;
    this.leaveBackground();
  }

  reopen(): void {
    this.options.openWindow();
    this.leaveBackground();
  }

  private start(request: "close" | "quit"): void {
    this.pending = request;
    void this.decide(request);
  }

  private async decide(request: "close" | "quit"): Promise<void> {
    try {
      const summary = await this.readSummary();
      const choice = await this.choose(request, summary);
      if (this.quitting) return;
      if (choice === "quit") this.startQuit();
      else if (choice === "background") this.enterBackground(summary);
    } catch (error) {
      this.options.log(`Could not settle the window close, so it was held: ${String(error)}`);
    } finally {
      this.pending = null;
      this.releaseHeldQuit();
    }
  }

  private async choose(
    request: "close" | "quit",
    summary: LocalWorkSummary | null,
  ): Promise<CloseChoice> {
    if (summary !== null && !hasLiveWork(summary)) return "quit";
    if (request === "close") return this.options.askCloseChoice(summary);
    return (await this.options.confirmQuit(summary)) ? "quit" : "cancel";
  }

  private releaseHeldQuit(): void {
    if (!this.quitRequested || this.quitting) return;
    this.quitRequested = false;
    this.options.quit();
  }

  private startQuit(): void {
    this.quitting = true;
    this.leaveBackground();
    this.options.quit();
  }

  private async readSummary(): Promise<LocalWorkSummary | null> {
    const reading = await this.options.readWork();
    if (reading.ok) return reading.summary;
    this.options.log(reading.message);
    return null;
  }

  private enterBackground(summary: LocalWorkSummary | null): void {
    this.tray ??= this.options.createTray({
      open: () => this.reopen(),
      quit: () => this.options.quit(),
    });
    this.tray.render(summary);
    this.options.hideWindow();
    this.refresh ??= setInterval(() => void this.refreshTray(), REFRESH_INTERVAL_MS);
  }

  private async refreshTray(): Promise<void> {
    try {
      this.tray?.render(await this.readSummary());
    } catch (error) {
      this.options.log(`Could not refresh the menu-bar item: ${String(error)}`);
    }
  }

  private leaveBackground(): void {
    if (this.refresh !== null) clearInterval(this.refresh);
    this.refresh = null;
    this.tray?.destroy();
    this.tray = null;
  }
}
