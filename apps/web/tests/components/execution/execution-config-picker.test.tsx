// @vitest-environment happy-dom
import type { ProviderOptionSet, RuntimeDescriptor } from "@otomat/domain";
import { ExecutionConfigPicker } from "@web/components/execution/execution-config-picker";
import { encodeRuntimeChoice } from "@web/lib/agent-choice";
import type { ExecutionSelection } from "@web/lib/execution/selection";
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

const DESCRIPTORS = [descriptor("claude"), descriptor("codex")];

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  announced = providerOptionSet();
});

async function render(value: ExecutionSelection) {
  const mounted = await mount(
    <ExecutionConfigPicker
      level="launch"
      value={value}
      onChange={vi.fn()}
      profiles={[]}
      descriptors={DESCRIPTORS}
      label="Single run"
    />,
  );
  cleanups.push(mounted.cleanup);
  return mounted;
}

function triggerLabel(): string {
  const found = document.querySelector<HTMLButtonElement>(
    "button[aria-label^='Single run execution configuration']",
  );
  if (!found) throw new Error("execution trigger not found");
  return found.getAttribute("aria-label") ?? "";
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
  // Nothing selects the permission mode, so the CLI's own default is what the summary names.
  expect(label).toContain("Accept edits");
  expect(label).toContain("High");
});

it("summarises the Codex keys for a Codex agent, and no Claude one", async () => {
  announced = CODEX_ANNOUNCED;
  await render({ agent: encodeRuntimeChoice("codex"), options: {} });

  const label = triggerLabel();
  expect(label).toContain("codex");
  expect(label).toContain("Workspace write");
  expect(label).toContain("Medium");
  expect(label).not.toContain("Accept edits");
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
