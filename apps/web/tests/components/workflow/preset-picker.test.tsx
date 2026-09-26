// @vitest-environment happy-dom
import { WORKFLOW_PRESET_NAME_MAX_LENGTH, type WorkflowPresetContract } from "@otomat/domain";
import { WorkflowPresetPicker } from "@web/components/workflow/preset/preset-picker";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { pressKey } from "#support/dom-events";
import { findLabelled, findMenuItem } from "#support/dom-queries";
import { mountWithQuery } from "#support/mount";

const listWorkflowPresets = vi.fn<() => Promise<WorkflowPresetContract[]>>(async () => []);

vi.mock("@web/api/client", () => ({
  daemon: { listWorkflowPresets: (projectId?: string) => listWorkflowPresets(projectId) },
}));

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  vi.clearAllMocks();
  listWorkflowPresets.mockResolvedValue([]);
});

function preset(overrides: Partial<WorkflowPresetContract> = {}): WorkflowPresetContract {
  return {
    id: "preset-1",
    name: "Implement, then review",
    scope: "global",
    project_id: null,
    plan: {
      version: 1,
      steps: [{ id: "implement", name: "Implement", agent: "claude", depends_on: [] }],
    },
    compatibility: { launchable: true, issues: [] },
    ...overrides,
  };
}

async function openPicker(onApply = vi.fn()) {
  const mounted = await mountWithQuery(
    <WorkflowPresetPicker projectId="p1" onApply={onApply} onSaveCurrent={vi.fn()} />,
  );
  cleanups.push(mounted.cleanup);
  await act(async () => {
    mounted.container.querySelector("button")?.click();
  });
  return { onApply };
}

function focusedPreset(): HTMLElement {
  const item = findMenuItem("Implement, then review");
  if (item === undefined || document.activeElement !== item) {
    throw new Error("the preset does not hold the focus");
  }
  return item;
}

it("scopes its read to the project it composes for", async () => {
  await openPicker();

  expect(listWorkflowPresets).toHaveBeenCalledWith("p1");
});

it("hands the whole preset to the surface that fills its composition", async () => {
  listWorkflowPresets.mockResolvedValue([preset()]);
  const { onApply } = await openPicker();

  await act(async () => {
    findMenuItem("Implement, then review")?.click();
  });

  expect(onApply).toHaveBeenCalledWith(preset());
});

it("refuses a preset this host cannot launch, and says which node blocks it", async () => {
  listWorkflowPresets.mockResolvedValue([
    preset({
      compatibility: {
        launchable: false,
        issues: [
          {
            node_id: "implement",
            node_name: "Implement",
            error: "runtime_unavailable",
            message: "claude is not installed here",
          },
        ],
      },
    }),
  ]);
  const { onApply } = await openPicker();

  const item = [...document.body.querySelectorAll<HTMLElement>("[role='menuitem']")].find((node) =>
    node.textContent?.includes("Implement, then review"),
  );
  expect(item?.textContent).toContain("claude is not installed here");
  expect(item?.getAttribute("aria-disabled")).toBe("true");

  await act(async () => item?.click());
  expect(onApply).not.toHaveBeenCalled();
});

it("says the library is empty rather than showing nothing at all", async () => {
  await openPicker();

  expect(document.body.textContent).toContain("No preset saved yet");
  expect(findLabelled("Workflow presets")).toBeDefined();
});

it("anchors a bounded popup to the Presets button and scrolls a long list inside it", async () => {
  listWorkflowPresets.mockResolvedValue(
    Array.from({ length: 40 }, (_, index) => preset({ id: `preset-${index}` })),
  );
  await openPicker();

  const popup = findLabelled("Workflow presets");
  expect(popup?.getAttribute("data-side")).toBe("bottom");
  expect(popup?.getAttribute("data-align")).toBe("start");
  expect(popup?.className).toContain("max-w-[min(20rem,calc(100vw-2rem))]");
  expect(popup?.className).toContain("max-h-[min(22rem,var(--available-height))]");
  expect(popup?.className).toContain("overflow-y-auto");
  expect(popup?.querySelectorAll("[role='menuitem']")).toHaveLength(41);
});

it("wraps a long name and its blocked reason instead of widening or clipping the row", async () => {
  const name = "N".repeat(WORKFLOW_PRESET_NAME_MAX_LENGTH);
  listWorkflowPresets.mockResolvedValue([
    preset({
      name,
      compatibility: {
        launchable: false,
        issues: [
          {
            node_id: "implement",
            node_name: "Implement",
            error: "runtime_unavailable",
            message: "claude is not installed on this host, install it or pick another agent",
          },
        ],
      },
    }),
  ]);
  await openPicker();

  const item = document.body.querySelector<HTMLElement>("[role='menuitem'][aria-disabled='true']");
  expect(item?.textContent).toContain(name);
  expect(item?.textContent).toContain("install it or pick another agent");
  expect(item?.querySelector(".truncate")).toBeNull();
  expect(item?.querySelector(".break-words")?.textContent).toContain(name);
  expect(item?.className).toContain("h-auto");
});

it("opens, applies and closes with the keyboard alone", async () => {
  listWorkflowPresets.mockResolvedValue([preset()]);
  const onApply = vi.fn();
  const mounted = await mountWithQuery(
    <WorkflowPresetPicker projectId="p1" onApply={onApply} onSaveCurrent={vi.fn()} />,
  );
  cleanups.push(mounted.cleanup);
  const trigger = mounted.container.querySelector("button");
  if (trigger === null) throw new Error("the Presets trigger is missing");

  trigger.focus();
  await pressKey("ArrowDown", trigger);
  await pressKey("Escape", focusedPreset());
  expect(findLabelled("Workflow presets")).toBeUndefined();
  expect(document.activeElement).toBe(trigger);

  await pressKey("ArrowDown", trigger);
  await pressKey("Enter", focusedPreset());
  expect(onApply).toHaveBeenCalledWith(preset());
  expect(document.activeElement).toBe(trigger);
});
