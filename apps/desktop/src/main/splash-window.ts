import type { BrowserWindow } from "electron";

import { SPLASH_STATUS_CHANNEL, type StartupStatus } from "#shared/startup";

export class SplashWindow {
  private window: BrowserWindow | null = null;

  constructor(private readonly create: () => Promise<BrowserWindow>) {}

  async open(): Promise<void> {
    this.window = await this.create();
  }

  send(status: StartupStatus): void {
    this.live()?.webContents.send(SPLASH_STATUS_CHANNEL, status);
  }

  focus(): void {
    const window = this.live();
    if (window === null) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  }

  close(): void {
    this.live()?.close();
    this.window = null;
  }

  /** The operator can close the splash themselves, and every call onto a destroyed window throws. */
  private live(): BrowserWindow | null {
    if (this.window === null || this.window.isDestroyed()) return null;
    return this.window;
  }
}
