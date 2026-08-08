// @vitest-environment happy-dom
import type { LinearSyncStatusContract } from "@otomat/domain";
import type { ProjectLinearSync } from "@web/api/linear/use-project-sync";
import { LinearSyncControl } from "@web/components/issues/linear-sync/control";
import { describeLinearSync } from "@web/components/issues/linear-sync/describe";
import { afterEach, expect, it, vi } from "vitest";

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

function refreshButton(container: HTMLElement): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find((candidate) =>
    candidate.textContent?.includes("Refresh issues"),
  );
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

  expect(button).toBeDefined();
  expect(button?.tagName).toBe("BUTTON");
  expect(button?.disabled).toBe(false);
  button?.click();

  expect(refresh).toHaveBeenCalledWith({ announce: true });
});

it("refuses a second launch while a pass is running", async () => {
  const container = await renderControl(sync({ running: true }));

  expect(refreshButton(container)?.disabled).toBe(true);
  expect(container.textContent).toContain("Syncing…");
});

it("disables the control when nothing is mapped and says so", async () => {
  const container = await renderControl(sync({ status: status({ sources: 0 }) }));

  expect(refreshButton(container)?.disabled).toBe(true);
  expect(container.textContent).toContain("No Linear team mapped");
});

it("shows an actionable failure instead of a last-sync time", async () => {
  const container = await renderControl(
    sync({
      status: status({
        last_error: { code: "linear_unauthorized", message: "Linear rejected the API key." },
      }),
    }),
  );

  expect(container.querySelector("[role='alert']")?.textContent).toContain(
    "Linear rejected the API key.",
  );
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
