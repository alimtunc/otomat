import type { CloseChoice } from "./prompts.js";
import type { LocalWorkReading } from "./read-work.js";
import type { BackgroundTrayActions } from "./tray.js";
import { hasLiveWork, type LocalWorkItem } from "./work-items.js";

const REFRESH_INTERVAL_MS = 5_000;

/** The menu-bar item this mode drives; `BackgroundTray` implements it. */
export interface BackgroundTrayPort {
  render(items: readonly LocalWorkItem[] | null): void;
  destroy(): void;
}

export interface BackgroundModeOptions {
  readWork(): Promise<LocalWorkReading>;
  askCloseChoice(items: readonly LocalWorkItem[] | null): Promise<CloseChoice>;
  createTray(actions: BackgroundTrayActions): BackgroundTrayPort;
  hideWindow(): void;
  openWindow(): void;
  openRun(runId: string): void;
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
    void this.decide();
  }

  private async decide(): Promise<void> {
    try {
      const items = await this.readItems();
      const choice = await this.choose(items);
      if (this.quitting) return;
      if (choice === "quit") this.startQuit();
      else if (choice === "background") this.enterBackground(items);
    } catch (error) {
      this.options.log(
        `Could not settle the quit the operator asked for, so it was held: ${String(error)}`,
      );
    } finally {
      this.pending = null;
      this.releaseHeldQuit();
    }
  }

  /** Every quit the operator asks for is offered the background, so none of them cuts a live run by surprise. */
  private async choose(items: readonly LocalWorkItem[] | null): Promise<CloseChoice> {
    if (items !== null && !hasLiveWork(items)) return "quit";
    return this.options.askCloseChoice(items);
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

  private async readItems(): Promise<LocalWorkItem[] | null> {
    const reading = await this.options.readWork();
    if (reading.ok) return reading.items;
    this.options.log(reading.message);
    return null;
  }

  private enterBackground(items: readonly LocalWorkItem[] | null): void {
    this.tray ??= this.options.createTray({
      open: () => this.reopen(),
      openRun: (runId) => {
        this.reopen();
        this.options.openRun(runId);
      },
      quit: () => this.options.quit(),
    });
    this.tray.render(items);
    this.options.hideWindow();
    this.refresh ??= setInterval(() => void this.refreshTray(), REFRESH_INTERVAL_MS);
  }

  private async refreshTray(): Promise<void> {
    try {
      this.tray?.render(await this.readItems());
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
