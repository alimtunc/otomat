import { Menu, nativeImage, Tray, type MenuItemConstructorOptions } from "electron";

import { LOCAL_WORK_STATES, type LocalWorkItem, type LocalWorkState } from "./work-items.js";
import { localWorkLines } from "./work-lines.js";

export interface BackgroundTrayActions {
  open(): void;
  openRun(runId: string): void;
  quit(): void;
}

const GROUP_LABELS = {
  waiting: "Awaiting you",
  running: "Running",
  failed: "Failed",
} satisfies Record<LocalWorkState, string>;

const VISIBLE_RUNS = 5;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** Coarse on purpose: the menu is rebuilt every few seconds and must not read as a stopwatch. */
function elapsed(startedAt: string, now: number): string {
  const running = now - Date.parse(startedAt);
  if (running < MINUTE_MS) return "just started";
  if (running < HOUR_MS) return `${Math.floor(running / MINUTE_MS)}m`;
  return `${Math.floor(running / HOUR_MS)}h`;
}

export function trayTitle(items: readonly LocalWorkItem[] | null): string {
  if (items === null) return "?";
  const live = items.filter((item) => item.state !== "failed");
  if (live.length === 0) return "";
  return `${live.some((item) => item.state === "waiting") ? "● " : ""}${live.length}`;
}

/** A system menu carries no prompt, no conversation and no secret. */
function runRow(
  item: LocalWorkItem,
  now: number,
  actions: BackgroundTrayActions,
): MenuItemConstructorOptions {
  const age = item.started_at === null ? [] : [elapsed(item.started_at, now)];
  return {
    label: [item.issue, item.project, "Local", ...age].join(" · "),
    click: () => actions.openRun(item.run_id),
  };
}

function runRows(
  items: readonly LocalWorkItem[],
  now: number,
  actions: BackgroundTrayActions,
): MenuItemConstructorOptions[] {
  const listed = items.slice(0, VISIBLE_RUNS);
  const rows: MenuItemConstructorOptions[] = [];
  for (const state of LOCAL_WORK_STATES) {
    const group = listed.filter((item) => item.state === state);
    if (group.length === 0) continue;
    rows.push({ type: "separator" }, { label: GROUP_LABELS[state], enabled: false });
    rows.push(...group.map((item) => runRow(item, now, actions)));
  }
  if (items.length > listed.length) {
    rows.push({ label: "Show all in Otomat", click: () => actions.open() });
  }
  return rows;
}

export function trayMenuTemplate(
  items: readonly LocalWorkItem[] | null,
  actions: BackgroundTrayActions,
  now: number,
): MenuItemConstructorOptions[] {
  return [
    ...localWorkLines(items).map((label) => ({ label, enabled: false })),
    ...runRows(items ?? [], now, actions),
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

  render(items: readonly LocalWorkItem[] | null): void {
    this.tray.setTitle(trayTitle(items));
    this.tray.setContextMenu(
      Menu.buildFromTemplate(trayMenuTemplate(items, this.actions, Date.now())),
    );
  }

  destroy(): void {
    this.tray.destroy();
  }
}
