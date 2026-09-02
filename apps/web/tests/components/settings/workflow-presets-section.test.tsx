// @vitest-environment happy-dom
import type { WorkflowPresetContract } from "@otomat/domain";
import { WorkflowPresetsSection } from "@web/components/settings/workflow-presets/section";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { setInputValue } from "#support/dom-events";
import { findButton, findLabelled, findMenuItem } from "#support/dom-queries";
import { mountWithQuery } from "#support/mount";

const listWorkflowPresets = vi.fn<() => Promise<WorkflowPresetContract[]>>(async () => []);
const deleteWorkflowPreset = vi.fn(async () => {});
const duplicateWorkflowPreset = vi.fn();
const createWorkflowPreset = vi.fn();

vi.mock("@web/api/client", () => ({
  daemon: {
    listWorkflowPresets: (projectId?: string) => listWorkflowPresets(projectId),
    deleteWorkflowPreset: (id: string) => deleteWorkflowPreset(id),
    duplicateWorkflowPreset: (id: string, request: unknown) => duplicateWorkflowPreset(id, request),
    createWorkflowPreset: (request: unknown) => createWorkflowPreset(request),
    listRuntimes: async () => [],
    listAgentProfiles: async () => [],
  },
}));

vi.mock("@web/components/shell/project-selection/use-selected", () => ({
  useSelectedProject: () => ({ projectId: "p1", projects: { data: [] } }),
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

async function renderSection() {
  const mounted = await mountWithQuery(<WorkflowPresetsSection />);
  cleanups.push(mounted.cleanup);
  return mounted;
}

it("offers a first preset when the library is empty, naming whose library it is", async () => {
  await renderSection();

  expect(document.body.textContent).toContain("No workflow preset on Local yet");
  expect(findButton("New preset")).toBeDefined();
});

it("groups each preset under the scope it is offered in, with its step count", async () => {
  listWorkflowPresets.mockResolvedValue([
    preset(),
    preset({ id: "preset-2", name: "Local sweep", scope: "project", project_id: "p1" }),
  ]);

  await renderSection();

  expect(document.body.textContent).toContain("This project");
  expect(document.body.textContent).toContain("Global");
  expect(document.body.textContent).toContain("1 step");
});

it("says why an incompatible preset could not be launched here", async () => {
  listWorkflowPresets.mockResolvedValue([
    preset({
      compatibility: {
        launchable: false,
        issues: [
          {
            node_id: "implement",
            node_name: "Implement",
            error: "runtime_unavailable",
            message: 'runtime "claude" is unavailable (binary_not_found)',
          },
        ],
      },
    }),
  ]);

  await renderSection();

  expect(document.body.textContent).toContain(
    'Implement: runtime "claude" is unavailable (binary_not_found)',
  );
});

it("saves the name and scope its dialog collected, with an empty composition", async () => {
  createWorkflowPreset.mockResolvedValue(preset({ id: "preset-2", name: "Nightly sweep" }));
  await renderSection();

  await act(async () => {
    findButton("New preset")?.click();
  });
  const name = document.querySelector<HTMLInputElement>("input[aria-label='Preset name']");
  if (name === null) throw new Error("preset name field not found");
  await act(async () => {
    setInputValue(name, "Nightly sweep");
  });
  await act(async () => {
    findButton("Create preset")?.click();
  });

  expect(createWorkflowPreset).toHaveBeenCalledWith({
    scope: "global",
    name: "Nightly sweep",
    plan: { version: 1, steps: [] },
  });
});

it("refuses to save a preset until it is named", async () => {
  await renderSection();

  await act(async () => {
    findButton("New preset")?.click();
  });

  expect(findButton("Create preset")?.disabled).toBe(true);
});

it("deletes only after the action is confirmed", async () => {
  listWorkflowPresets.mockResolvedValue([preset()]);
  await renderSection();

  await act(async () => {
    findLabelled("Actions for Implement, then review")?.click();
  });
  await act(async () => {
    findMenuItem("Delete")?.click();
  });
  expect(deleteWorkflowPreset).not.toHaveBeenCalled();

  await act(async () => {
    findButton("Confirm")?.click();
  });
  expect(deleteWorkflowPreset).toHaveBeenCalledWith("preset-1");
});

it("copies a global preset into the selected project", async () => {
  listWorkflowPresets.mockResolvedValue([preset()]);
  duplicateWorkflowPreset.mockResolvedValue(preset({ id: "preset-2", scope: "project" }));
  await renderSection();

  await act(async () => {
    findLabelled("Actions for Implement, then review")?.click();
  });
  await act(async () => {
    findMenuItem("Duplicate into This project")?.click();
  });

  expect(duplicateWorkflowPreset).toHaveBeenCalledWith("preset-1", {
    scope: "project",
    project_id: "p1",
  });
});
