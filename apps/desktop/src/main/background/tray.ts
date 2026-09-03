import { Menu, nativeImage, Tray, type MenuItemConstructorOptions } from "electron";

import { localWorkLines } from "./work-lines.js";
import type { LocalWorkSummary } from "./work-summary.js";

export interface BackgroundTrayActions {
  open(): void;
  quit(): void;
}

/** Menu-bar text: a run blocked on the operator outranks one that is merely working. */
export function trayTitle(summary: LocalWorkSummary | null): string {
  if (summary === null) return "?";
  if (summary.waiting > 0) return `⏸ ${summary.waiting}`;
  if (summary.active > 0) return `▶ ${summary.active}`;
  return "";
}

/** Counts only: a system menu carries no issue title, no prompt and no secret. */
export function trayMenuTemplate(
  summary: LocalWorkSummary | null,
  actions: BackgroundTrayActions,
): MenuItemConstructorOptions[] {
  return [
    ...localWorkLines(summary).map((label) => ({ label, enabled: false })),
    { type: "separator" },
    { label: "Open Otomat", click: () => actions.open() },
    { label: "Quit Otomat", click: () => actions.quit() },
  ];
}

export class BackgroundTray {
  private readonly tray: Tray;

  constructor(
    iconPath: string,
    private readonly actions: BackgroundTrayActions,
  ) {
    const icon = nativeImage.createFromPath(iconPath);
    // The menu bar tints a template image for the light and dark bar; a literal one only fits one.
    icon.setTemplateImage(true);
    this.tray = new Tray(icon);
    this.tray.setToolTip("Otomat");
  }

  render(summary: LocalWorkSummary | null): void {
    this.tray.setTitle(trayTitle(summary));
    this.tray.setContextMenu(Menu.buildFromTemplate(trayMenuTemplate(summary, this.actions)));
  }

  destroy(): void {
    this.tray.destroy();
  }
}
