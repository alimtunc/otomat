import type { MenuItemConstructorOptions } from "electron";
import { expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  Menu: { buildFromTemplate: vi.fn() },
  Tray: vi.fn(),
  nativeImage: { createFromPath: vi.fn() },
}));

import { trayMenuTemplate, trayTitle, type BackgroundTrayActions } from "#main/background/tray";

function actions(): BackgroundTrayActions {
  return { open: vi.fn(), quit: vi.fn() };
}

function click(template: MenuItemConstructorOptions[], label: string): void {
  const handler = template.find((item) => item.label === label)?.click;
  if (handler === undefined) throw new Error(`no menu item labelled ${label}`);
  // SAFETY: the template builds every handler as a zero-argument closure over the actions.
  (handler as () => void)();
}

it("marks a run awaiting the operator apart from one that is merely working", () => {
  expect(trayTitle({ active: 3, waiting: 2, failed: 0 })).not.toBe(
    trayTitle({ active: 3, waiting: 0, failed: 0 }),
  );
  expect(trayTitle({ active: 3, waiting: 2, failed: 0 })).toContain("2");
  expect(trayTitle({ active: 3, waiting: 0, failed: 0 })).toContain("3");
});

it("shows nothing next to the icon while the daemon is idle", () => {
  expect(trayTitle({ active: 0, waiting: 0, failed: 0 })).toBe("");
});

it("says the activity is unreadable rather than reporting a count it does not have", () => {
  expect(trayMenuTemplate(null, actions())[0]?.label).toBe(
    "Otomat could not read the local daemon's activity.",
  );
});

it("summarizes the counts and offers reopening and quitting, and nothing else", () => {
  const template = trayMenuTemplate({ active: 1, waiting: 2, failed: 3 }, actions());

  expect(template.map((item) => item.label)).toEqual([
    "1 run active",
    "2 awaiting you",
    "3 failed",
    undefined,
    "Open Otomat",
    "Quit Otomat",
  ]);
  expect(template.filter((item) => item.enabled === false)).toHaveLength(3);
});

it("reopens and quits through the actions it was given", () => {
  const given = actions();
  const template = trayMenuTemplate({ active: 1, waiting: 0, failed: 0 }, given);

  click(template, "Open Otomat");
  click(template, "Quit Otomat");

  expect(given.open).toHaveBeenCalledOnce();
  expect(given.quit).toHaveBeenCalledOnce();
});
