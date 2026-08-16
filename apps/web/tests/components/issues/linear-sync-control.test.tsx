// @vitest-environment happy-dom
import type { LinearSyncStatusContract } from "@otomat/domain";
import type { ProjectLinearSync } from "@web/api/linear/use-project-sync";
import { LinearSyncControl } from "@web/components/issues/linear-sync/control";
import { describeLinearSync } from "@web/components/issues/linear-sync/describe";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { findMenuItem, findRefreshButton } from "#support/dom-queries";
import { mount, type Mounted } from "#support/mount";

function status(overrides: Partial<LinearSyncStatusContract> = {}): LinearSyncStatusContract {
  return {
    project_id: "p1",
    sources: 1,
    running: false,
    last_synced_at: "2026-07-20T12:00:00.000Z",
    last_result: null,
    last_error: null,
    ...overrides,
  };
}

const refresh = vi.fn();

function sync(overrides: Partial<ProjectLinearSync> = {}): ProjectLinearSync {
  return {
    status: status(),
    running: false,
    refresh,
    refreshIfStale: vi.fn(),
    ...overrides,
  };
}

let rendered: Mounted | null = null;

async function renderControl(value: ProjectLinearSync): Promise<HTMLElement> {
  rendered = await mount(<LinearSyncControl sync={value} />);
  return rendered.container;
}

function refreshButton(container: HTMLElement): HTMLButtonElement {
  const button = findRefreshButton(container);
  if (button === null) throw new Error("the refresh button is missing");
  return button;
}

afterEach(async () => {
  await rendered?.cleanup();
  rendered = null;
  refresh.mockReset();
  document.body.replaceChildren();
});

it("offers a keyboard-reachable refresh that scopes to the active project", async () => {
  const container = await renderControl(sync());
  const button = refreshButton(container);

  expect(button.tagName).toBe("BUTTON");
  expect(button.disabled).toBe(false);
  button.click();

  expect(refresh).toHaveBeenCalledWith({ announce: true });
});

it("spends no toolbar width on the report, carrying it on the button instead", async () => {
  const container = await renderControl(
    sync({ status: status({ last_result: { imported: 2, updated: 1 } }) }),
  );

  expect(container.textContent).toBe("");
  expect(refreshButton(container).getAttribute("aria-label")).toBe(
    "Refresh issues — 2 imported, 1 updated",
  );
  expect(container.firstElementChild?.className).not.toMatch(/\bw-|\bmin-w-/);
});

it("restores the last report and its date in the tooltip, on focus as on hover", async () => {
  const container = await renderControl(
    sync({ status: status({ last_result: { imported: 2, updated: 1 } }) }),
  );
  await act(async () => refreshButton(container).focus());

  expect(document.body.textContent).toContain("2 imported, 1 updated");
  expect(document.body.querySelector("time")).not.toBeNull();
});

it("refuses a second launch while a pass is running", async () => {
  const container = await renderControl(sync({ running: true }));
  const button = refreshButton(container);

  expect(button.disabled).toBe(true);
  expect(button.getAttribute("aria-label")).toContain("Syncing…");
});

it("disables the control when nothing is mapped and says so", async () => {
  const container = await renderControl(sync({ status: status({ sources: 0 }) }));
  const button = refreshButton(container);

  expect(button.disabled).toBe(true);
  expect(button.getAttribute("aria-label")).toContain("No Linear team mapped");
});

it("shows an actionable failure on the button rather than a line the toolbar has to fit", async () => {
  const container = await renderControl(
    sync({
      status: status({
        last_error: { code: "linear_unauthorized", message: "Linear rejected the API key." },
      }),
    }),
  );
  const button = refreshButton(container);

  expect(button.getAttribute("aria-label")).toContain("Linear rejected the API key.");
  expect(button.querySelector("svg")?.getAttribute("class")).toContain("text-danger");
});

it("announces a failure an automatic pass raised no toast for, without taking width", async () => {
  const container = await renderControl(
    sync({
      status: status({ last_error: { code: "auth", message: "Linear rejected the API key." } }),
    }),
  );
  const alert = container.querySelector("[role='alert']");

  expect(alert?.textContent).toBe("Linear rejected the API key.");
  expect(alert?.className).toContain("sr-only");
});

it("keeps a full resync one chevron away", async () => {
  const container = await renderControl(sync());
  const chevron = container.querySelector<HTMLButtonElement>(
    "button[aria-label='Linear sync options']",
  );
  await act(async () => chevron?.click());

  const full = findMenuItem("Full resync");
  if (full === undefined) throw new Error("Full resync is missing");
  await act(async () => full.click());

  expect(refresh).toHaveBeenCalledWith({ full: true, announce: true });
});

const LABELS: [LinearSyncStatusContract, string][] = [
  [status({ last_result: { imported: 0, updated: 0 } }), "No changes"],
  [status({ last_result: { imported: 2, updated: 1 } }), "2 imported, 1 updated"],
  [status({ last_synced_at: null }), "Never synced"],
  [status({ running: true }), "Syncing…"],
  [status({ sources: 0 }), "No Linear team mapped"],
];

it.each(LABELS)("keeps each sync state distinct in the label", (value, expected) => {
  expect(describeLinearSync(value, value.running).text).toBe(expected);
});

it("says nothing at all before the owning daemon has answered", () => {
  expect(describeLinearSync(null, false)).toEqual({ text: "", tone: "muted", syncedAt: null });
});
