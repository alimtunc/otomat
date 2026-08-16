// @vitest-environment happy-dom
import type { WorkflowPresetContract } from "@otomat/domain";
import { WorkflowPresetPicker } from "@web/components/workflow/preset/preset-picker";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

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
