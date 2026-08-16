// @vitest-environment happy-dom
import {
  providerOptionDescriptor,
  type AgentProfileContract,
  type ProviderOptionSet,
  type RuntimeDescriptor,
} from "@otomat/domain";
import { ExecutionConfigPicker } from "@web/components/execution/execution-config-picker";
import { encodeProfileChoice, encodeRuntimeChoice } from "@web/lib/agent-choice";
import type { ExecutionSelection } from "@web/lib/execution/selection";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { CLAUDE_ANNOUNCED, CODEX_ANNOUNCED } from "#support/announced-options";
import { executionDefaultsQueryResult } from "#support/execution-defaults";
import { mount } from "#support/mount";
import { modelCatalogQueryResult } from "#support/runtime-models";
import { providerOptionSet, providerOptionSetQueryResult } from "#support/runtime-options";

let announced: ProviderOptionSet = providerOptionSet();

vi.mock("@web/api/daemon/queries", () => ({
  useRuntimeModels: () => modelCatalogQueryResult(),
  useRuntimeProviderOptions: () => providerOptionSetQueryResult(announced),
  useExecutionDefaults: () => executionDefaultsQueryResult(),
}));

function descriptor(id: string): RuntimeDescriptor {
  return {
    id,
    display_name: id,
    kind: "real",
    capabilities: {
      stream: true,
      steering: "turn_boundary",
      abort: true,
      resume: true,
      permissions: false,
      diff_hints: false,
    },
    availability: { status: "available", version: null },
  };
}

const DESCRIPTORS = [descriptor("claude"), descriptor("codex"), descriptor("fake")];

const PROFILE: AgentProfileContract = {
  id: "p1",
  name: "Careful reviewer",
  runtime: "claude",
  options: {},
  model: null,
  guidance: null,
  skill_ids: [],
};

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  announced = providerOptionSet();
});

async function render(value: ExecutionSelection, profiles: AgentProfileContract[] = []) {
  const mounted = await mount(
    <ExecutionConfigPicker
      level="launch"
      value={value}
      onChange={vi.fn()}
      profiles={profiles}
      descriptors={DESCRIPTORS}
      label="Single run"
    />,
  );
  cleanups.push(mounted.cleanup);
  return mounted;
}

function trigger(): HTMLButtonElement {
  const found = document.querySelector<HTMLButtonElement>(
    "button[aria-label^='Single run execution configuration']",
  );
  if (!found) throw new Error("execution trigger not found");
  return found;
}

function triggerLabel(): string {
  return trigger().getAttribute("aria-label") ?? "";
}

function triggerSummary(): string {
  return trigger().querySelector(".truncate")?.textContent ?? "";
}

async function openSubmenu(label: string): Promise<void> {
  await act(async () => trigger().click());
  const submenu = document.querySelector<HTMLElement>(`[aria-label^='${label}:']`);
  if (!submenu) throw new Error(`${label} submenu not found`);
  await act(async () => submenu.click());
}

it("summarises runtime, model and every announced option on the one visible control", async () => {
  announced = CLAUDE_ANNOUNCED;
  await render({
    agent: encodeRuntimeChoice("claude"),
    model: { kind: "model", id: "opus" },
    options: { effort: { kind: "value", value: "high" } },
  });

  const label = triggerLabel();
  expect(label).toContain("claude");
  expect(label).toContain("opus");
  // Nothing selects the permission mode, so the autonomous default Otomat sends is what the summary names.
  expect(label).toContain("Auto");
  expect(label).toContain("High");
});

it("shows only the choices, leaving the provider to its mark, and still announces it", async () => {
  announced = CLAUDE_ANNOUNCED;
  const mounted = await render({
    agent: encodeRuntimeChoice("claude"),
    model: { kind: "model", id: "opus" },
    options: { effort: { kind: "value", value: "high" } },
  });

  expect(triggerSummary()).toBe("opus · Auto · High");
  expect(triggerLabel()).toBe("Single run execution configuration: claude · opus · Auto · High");
  expect(mounted.container.querySelector("svg[viewBox='0 0 16 16']")).not.toBeNull();
});

it("keeps a profile's own name on the trigger, which its provider mark cannot give", async () => {
  announced = CLAUDE_ANNOUNCED;
  await render({ agent: encodeProfileChoice(PROFILE.id), options: {} }, [PROFILE]);

  expect(triggerSummary()).toContain("Careful reviewer");
});

it("keeps the agent visible for a runtime that has no mark to name it", async () => {
  announced = providerOptionSet({ runtime: "fake", options: [] });
  await render({ agent: encodeRuntimeChoice("fake"), options: {} });

  expect(triggerSummary()).toBe("fake · Provider default");
});

it("summarises the Codex keys for a Codex agent, and no Claude one", async () => {
  announced = CODEX_ANNOUNCED;
  await render({ agent: encodeRuntimeChoice("codex"), options: {} });

  const label = triggerLabel();
  expect(label).toContain("codex");
  expect(label).toContain("Workspace write");
  // Otomat sends no reasoning effort of its own, so the summary names none.
  expect(label).not.toContain("Medium");
  expect(label).not.toContain("Auto");
});

it("names each Claude permission mode as Claude does, without echoing the flag value", async () => {
  announced = CLAUDE_ANNOUNCED;
  await render({ agent: encodeRuntimeChoice("claude"), options: {} });

  await openSubmenu("Permission mode");
  const modes = [...document.querySelectorAll("[role='menuitemradio']")].map(
    (choice) => choice.querySelector(".truncate")?.textContent ?? "",
  );

  expect(modes).toContain("Edit automatically");
  expect(modes).toContain("Auto — recommended");
  expect(modes).toContain("Plan");
  expect(modes).toContain("Bypass permissions — removes a safety boundary");
  expect(document.querySelector("[role='menuitemradio'] code")).toBeNull();
});

it("never presents a boundary-removing value as the effective default", async () => {
  const permission = providerOptionDescriptor(CLAUDE_ANNOUNCED.options, "permission_mode");
  if (permission === null) throw new Error("the Claude fixture must announce a permission mode");
  announced = providerOptionSet({
    options: [{ ...permission, default_value: "bypassPermissions" }],
  });

  await render({ agent: encodeRuntimeChoice("claude"), options: {} });

  expect(triggerLabel()).not.toContain("Bypass permissions");
});

it("marks a selected value the current runtime and model no longer announce", async () => {
  announced = CLAUDE_ANNOUNCED;
  const mounted = await render({
    agent: encodeRuntimeChoice("claude"),
    options: { effort: { kind: "value", value: "ultra" } },
  });

  const alert = mounted.container.querySelector("[role='alert']");
  expect(alert?.textContent).toContain("no longer announce");
  expect(alert?.textContent).toContain("Effort");
});

it("shows a custom model identifier beside the trigger, and marks one the daemon would refuse", async () => {
  announced = CLAUDE_ANNOUNCED;
  const mounted = await render({
    agent: encodeRuntimeChoice("claude"),
    model: { kind: "model", id: "" },
    options: {},
  });

  const input = mounted.container.querySelector<HTMLInputElement>(
    "input[aria-label='Single run custom model identifier']",
  );
  expect(input).not.toBeNull();
  expect(input?.getAttribute("aria-invalid")).toBe("true");
});
