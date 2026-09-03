/** The window surface the cockpit drives; Electron's `BrowserWindow` satisfies it. */
export interface CockpitBrowserWindow {
  on(event: "close", listener: (event: { preventDefault(): void }) => void): void;
  on(event: "closed", listener: () => void): void;
  isMinimized(): boolean;
  restore(): void;
  show(): void;
  focus(): void;
  hide(): void;
  webContents: {
    isDestroyed(): boolean;
    send(channel: string, payload: unknown): void;
    reload(): void;
  };
}

export interface CockpitWindowOptions {
  create(): CockpitBrowserWindow;
  /** True holds the close: the operator is choosing, or the window is only hiding. */
  onClose(): boolean;
}

export class CockpitWindow {
  private window: CockpitBrowserWindow | null = null;

  constructor(private readonly options: CockpitWindowOptions) {}

  get isOpen(): boolean {
    return this.window !== null;
  }

  open(): void {
    if (this.window !== null) {
      this.show();
      return;
    }
    const window = this.options.create();
    window.on("close", (event) => {
      if (this.options.onClose()) event.preventDefault();
    });
    window.on("closed", () => (this.window = null));
    this.window = window;
  }

  show(): void {
    const window = this.window;
    if (window === null) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  }

  hide(): void {
    this.window?.hide();
  }

  send(channel: string, payload: unknown): void {
    const contents = this.window?.webContents;
    if (contents === undefined || contents.isDestroyed()) return;
    contents.send(channel, payload);
  }

  reload(): void {
    this.window?.webContents.reload();
  }
}
