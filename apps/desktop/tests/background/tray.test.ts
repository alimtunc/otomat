import type { MenuItemConstructorOptions } from "electron";
import { expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  Menu: { buildFromTemplate: vi.fn() },
  Tray: vi.fn(),
  nativeImage: { createFromPath: vi.fn() },
}));

import { trayMenuTemplate, trayTitle, type BackgroundTrayActions } from "#main/background/tray";
import type { LocalWorkItem, LocalWorkState } from "#main/background/work-items";

const NOW = Date.parse("2026-09-03T12:00:00.000Z");
const MINUTES_AGO = "2026-09-03T11:48:00.000Z";

function actions(): BackgroundTrayActions {
  return { open: vi.fn(), openRun: vi.fn(), quit: vi.fn() };
}

function item(state: LocalWorkState, overrides: Partial<LocalWorkItem> = {}): LocalWorkItem {
  return {
    run_id: `run-${state}`,
    project: "Otomat",
    issue: "OTO-1",
    state,
    started_at: MINUTES_AGO,
    ...overrides,
  };
}

function labels(template: MenuItemConstructorOptions[]): (string | undefined)[] {
  return template.map((entry) => entry.label);
}

function click(template: MenuItemConstructorOptions[], label: string): void {
  const handler = template.find((entry) => entry.label === label)?.click;
  if (handler === undefined) throw new Error(`no menu item labelled ${label}`);
  // SAFETY: the template builds every handler as a zero-argument closure over the actions.
  (handler as () => void)();
}

it("marks a run awaiting the operator apart from one that is merely working", () => {
  expect(trayTitle([item("running"), item("waiting")])).toBe("● 2");
  expect(trayTitle([item("running"), item("running", { run_id: "run-b" })])).toBe("2");
});

it("shows nothing next to the icon while no run is live, and a mark when it cannot tell", () => {
  expect(trayTitle([item("failed")])).toBe("");
  expect(trayTitle(null)).toBe("?");
});

it("says the activity is unreadable rather than listing runs it does not have", () => {
  const template = trayMenuTemplate(null, actions(), NOW);

  expect(labels(template)).toEqual([
    "Otomat could not read the local daemon's activity.",
    undefined,
    "Open Otomat",
    "Quit Otomat",
  ]);
});

it("keeps the totals, then lists each run under the state it is in", () => {
  const template = trayMenuTemplate(
    [
      item("waiting", { issue: "OTO-1" }),
      item("running", { issue: "OTO-2" }),
      item("failed", { issue: "OTO-3" }),
    ],
    actions(),
    NOW,
  );

  expect(labels(template)).toEqual([
    "1 run active",
    "1 awaiting you",
    "1 failed",
    undefined,
    "Awaiting you",
    "OTO-1 · Otomat · Local · 12m",
    undefined,
    "Running",
    "OTO-2 · Otomat · Local · 12m",
    undefined,
    "Failed",
    "OTO-3 · Otomat · Local · 12m",
    undefined,
    "Open Otomat",
    "Quit Otomat",
  ]);
});

it("leaves the duration out of a run that has not started", () => {
  const template = trayMenuTemplate([item("running", { started_at: null })], actions(), NOW);

  expect(labels(template)).toContain("OTO-1 · Otomat · Local");
});

it("opens the run the operator picked", () => {
  const given = actions();
  const template = trayMenuTemplate([item("running", { run_id: "run-42" })], given, NOW);

  click(template, "OTO-1 · Otomat · Local · 12m");

  expect(given.openRun).toHaveBeenCalledWith("run-42");
});

it("caps the list and offers the rest inside Otomat", () => {
  const many = Array.from({ length: 7 }, (_, index) =>
    item("running", { run_id: `run-${index}`, issue: `OTO-${index}` }),
  );
  const given = actions();
  const template = trayMenuTemplate(many, given, NOW);
  const rows = labels(template).filter((label) => label?.startsWith("OTO-") === true);

  expect(rows).toHaveLength(5);
  click(template, "Show all in Otomat");
  expect(given.open).toHaveBeenCalledOnce();
});

it("reopens and quits through the actions it was given", () => {
  const given = actions();
  const template = trayMenuTemplate([item("running")], given, NOW);

  click(template, "Open Otomat");
  click(template, "Quit Otomat");

  expect(given.open).toHaveBeenCalledOnce();
  expect(given.quit).toHaveBeenCalledOnce();
});
