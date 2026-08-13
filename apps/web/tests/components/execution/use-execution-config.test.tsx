// @vitest-environment happy-dom
import type { AgentProfileContract, ExecutionDefaults, ProviderOptionSet } from "@otomat/domain";
import {
  useExecutionConfig,
  type UseExecutionConfigOptions,
} from "@web/components/execution/use-execution-config";
import { encodeProfileChoice, encodeRuntimeChoice } from "@web/lib/agent-choice";
import { resolvedModelLabel, resolvedOptionLabel } from "@web/lib/execution/labels";
import { expect, it, vi } from "vitest";

import { CLAUDE_ANNOUNCED, CODEX_ANNOUNCED } from "#support/announced-options";
import { executionDefaultsQueryResult } from "#support/execution-defaults";
import { mount } from "#support/mount";
import { modelCatalogQueryResult } from "#support/runtime-models";
import { providerOptionSet, providerOptionSetQueryResult } from "#support/runtime-options";

let announced: ProviderOptionSet = providerOptionSet();
let defaults: ExecutionDefaults = { runtime: null, model: null, options: {} };

vi.mock("@web/api/daemon/queries", () => ({
  useRuntimeModels: () => modelCatalogQueryResult(),
  useRuntimeProviderOptions: () => providerOptionSetQueryResult(announced),
  useExecutionDefaults: () => executionDefaultsQueryResult(defaults),
}));

const PROFILE: AgentProfileContract = {
  id: "p1",
  name: "Careful",
  runtime: "claude",
  options: { permission_mode: "plan" },
  model: "opus",
  guidance: null,
  skill_ids: [],
};

function Probe(options: UseExecutionConfigOptions) {
  const config = useExecutionConfig(options);
  const profileName = config.profile?.name ?? null;
  const values = config.options
    .map((option) => {
      const label = resolvedOptionLabel(option.resolved, option.descriptor, profileName);
      return `${option.key}=${label}`;
    })
    .join(" | ");
  return (
    <div>
      <span data-testid="keys">{config.options.map((option) => option.key).join(",")}</span>
      <span data-testid="model">{resolvedModelLabel(config.model, profileName)}</span>
      <span data-testid="values">{values}</span>
      <span data-testid="stale">{config.stale.join(",")}</span>
    </div>
  );
}

async function probe(options: UseExecutionConfigOptions) {
  const mounted = await mount(<Probe {...options} />);
  const read = (testId: string) =>
    mounted.container.querySelector(`[data-testid='${testId}']`)?.textContent ?? "";
  return { read, cleanup: mounted.cleanup };
}

it("offers exactly the keys Claude announces, and exactly the keys Codex announces", async () => {
  announced = CLAUDE_ANNOUNCED;
  const claude = await probe({
    level: "launch",
    value: { agent: encodeRuntimeChoice("claude"), options: {} },
    profiles: [],
  });
  expect(claude.read("keys")).toBe("permission_mode,effort");
  await claude.cleanup();

  announced = CODEX_ANNOUNCED;
  const codex = await probe({
    level: "launch",
    value: { agent: encodeRuntimeChoice("codex"), options: {} },
    profiles: [],
  });
  expect(codex.read("keys")).toBe("sandbox,reasoning_effort");
  await codex.cleanup();
});

it("resolves each value down step > launch > profile > global, naming the level that answered", async () => {
  announced = CLAUDE_ANNOUNCED;
  defaults = { runtime: "claude", model: "sonnet", options: { effort: "low" } };

  const step = await probe({
    level: "step",
    value: { agent: null, options: { permission_mode: { kind: "value", value: "acceptEdits" } } },
    inherited: {
      agent: encodeProfileChoice("p1"),
      model: { kind: "model", id: "haiku" },
      options: {},
    },
    profiles: [PROFILE],
  });

  expect(step.read("values")).toBe(
    "permission_mode=Accept edits — set on this step | effort=Low — from the global defaults",
  );
  expect(step.read("model")).toBe("haiku — from the run");
  await step.cleanup();

  const launch = await probe({
    level: "launch",
    value: { agent: encodeProfileChoice("p1"), options: {} },
    profiles: [PROFILE],
  });

  expect(launch.read("values")).toBe(
    "permission_mode=Plan — from “Careful” | effort=Low — from the global defaults",
  );
  expect(launch.read("model")).toBe("opus — from “Careful”");
  await launch.cleanup();

  defaults = { runtime: null, model: null, options: {} };
});

it("keeps the runtime's own default when no level selects a value", async () => {
  announced = CLAUDE_ANNOUNCED;
  const mounted = await probe({
    level: "launch",
    value: { agent: encodeRuntimeChoice("claude"), options: {} },
    profiles: [],
  });

  expect(mounted.read("values")).toBe(
    "permission_mode=Runtime default — Auto | effort=Runtime default",
  );
  await mounted.cleanup();
});

it("ignores host defaults that name another runtime rather than carrying their options across", async () => {
  announced = CODEX_ANNOUNCED;
  defaults = { runtime: "claude", model: "opus", options: { permission_mode: "plan" } };

  const mounted = await probe({
    level: "launch",
    value: { agent: encodeRuntimeChoice("codex"), options: {} },
    profiles: [],
  });

  expect(mounted.read("model")).toBe("Provider's own default — Otomat sends no model");
  expect(mounted.read("values")).toBe(
    "sandbox=Runtime default — Workspace write | reasoning_effort=Runtime default",
  );
  await mounted.cleanup();

  defaults = { runtime: null, model: null, options: {} };
});

it("reports a selected value the current runtime and model no longer announce", async () => {
  announced = CLAUDE_ANNOUNCED;
  const mounted = await probe({
    level: "launch",
    value: {
      agent: encodeRuntimeChoice("claude"),
      options: { effort: { kind: "value", value: "ultra" } },
    },
    profiles: [],
  });

  expect(mounted.read("stale")).toBe("effort");
  await mounted.cleanup();
});
