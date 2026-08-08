// @vitest-environment happy-dom
import type { ProviderOptionDescriptor, ProviderOptionSet } from "@otomat/domain";
import { EffortSelect } from "@web/components/runs/launch/effort-select";
import { expect, it, vi } from "vitest";

import { mount } from "#support/mount";

let detected: ReturnType<typeof queryResult>;

vi.mock("@web/api/daemon/queries", () => ({
  useRuntimeProviderOptions: () => detected,
}));

/** `claude --help` announces these and no `ultra`; the bundled Codex catalog announces `ultra` for some models. */
function effortDescriptor(levels: string[], defaultValue: string | null): ProviderOptionDescriptor {
  return {
    key: "effort",
    description: "How much reasoning effort Claude Code spends on the session.",
    choices: levels.map((value) => ({ value, description: null, dangerous: false })),
    default_value: defaultValue,
  };
}

function queryResult(options: ProviderOptionDescriptor[]) {
  const data: ProviderOptionSet = {
    runtime: "claude",
    model: null,
    detection: { status: "ok", detail: "Announced by `claude --help`." },
    options,
  };
  return { data, isPending: false, isError: false, isSuccess: true, refetch: vi.fn() };
}

const CLAUDE = queryResult([effortDescriptor(["low", "medium", "high", "xhigh", "max"], null)]);

function text(container: Element): string {
  return container.textContent ?? "";
}

it("shows the level a step inherits from the run, so the effective effort is never hidden", async () => {
  detected = CLAUDE;
  const mounted = await mount(
    <EffortSelect
      offerRun
      runtimeId="claude"
      modelId={null}
      value={undefined}
      onValueChange={vi.fn()}
      resolved={{ level: "high", source: "run" }}
      ariaLabel="Step 1 effort"
    />,
  );

  expect(mounted.container.querySelector('[aria-label="Step 1 effort"]')?.textContent).toContain(
    "Same as run",
  );
  expect(text(mounted.container)).toContain("Effective: High — from the run");

  await mounted.cleanup();
});

it("names the profile a step's level came from when it keeps the agent default", async () => {
  detected = CLAUDE;
  const mounted = await mount(
    <EffortSelect
      offerRun
      runtimeId="claude"
      modelId={null}
      value={{ kind: "agent_default" }}
      onValueChange={vi.fn()}
      resolved={{ level: "low", source: "profile", profileName: "Careful" }}
      ariaLabel="Step 1 effort"
    />,
  );

  expect(mounted.container.querySelector('[aria-label="Step 1 effort"]')?.textContent).toContain(
    "Agent default",
  );
  expect(text(mounted.container)).toContain("Effective: Low — from profile “Careful”");

  await mounted.cleanup();
});

it("names the runtime default the descriptor publishes when nothing selects a level", async () => {
  detected = queryResult([effortDescriptor(["low", "medium", "high", "ultra"], "medium")]);
  const mounted = await mount(
    <EffortSelect
      runtimeId="codex"
      modelId="gpt-5.6-sol"
      value={{ kind: "agent_default" }}
      onValueChange={vi.fn()}
      resolved={{ level: null, source: "runtime" }}
      ariaLabel="Workflow effort"
    />,
  );

  expect(text(mounted.container)).toContain("Effective: Runtime default — Medium");

  await mounted.cleanup();
});

it("marks a level the installed CLI stopped announcing rather than rewriting the selection", async () => {
  detected = CLAUDE;
  const mounted = await mount(
    <EffortSelect
      offerRun
      runtimeId="claude"
      modelId={null}
      value={{ kind: "level", value: "ultra" }}
      onValueChange={vi.fn()}
      resolved={{ level: "ultra", source: "step" }}
      ariaLabel="Step 1 effort"
    />,
  );

  const alert = mounted.container.querySelector('[role="alert"]');
  expect(alert?.textContent).toContain("no longer announce");
  expect(alert?.textContent).toContain("ultra");
  expect(mounted.container.querySelector('[aria-label="Step 1 effort"]')?.textContent).toContain(
    "no longer offered",
  );

  await mounted.cleanup();
});

it("offers nothing to pick and says why when the runtime announces no effort at all", async () => {
  detected = queryResult([]);
  const mounted = await mount(
    <EffortSelect
      offerRun
      runtimeId="claude"
      modelId={null}
      value={undefined}
      onValueChange={vi.fn()}
      resolved={{ level: null, source: "runtime" }}
      ariaLabel="Step 1 effort"
    />,
  );

  expect(text(mounted.container)).toContain("Effective: Runtime default");
  expect(mounted.container.querySelector('[role="alert"]')).toBeNull();
  expect(
    mounted.container.querySelector('[aria-label="Where these effort levels come from"]'),
  ).not.toBeNull();

  await mounted.cleanup();
});
