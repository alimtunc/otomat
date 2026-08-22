// @vitest-environment happy-dom
import type { ProviderOptionSet, ResolvedAgentConfig, RuntimeModelCatalog } from "@otomat/domain";
import { NextTurnModelDialog } from "@web/components/runs/conversation/next-turn-model-dialog";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { findButton, findLabelled } from "#support/dom-queries";
import { mount } from "#support/mount";
import { modelCatalogQueryResult } from "#support/runtime-models";
import { providerOptionSetQueryResult } from "#support/runtime-options";

const mutate = vi.fn((_request: unknown, callbacks?: { onSuccess?: () => void }) =>
  callbacks?.onSuccess?.(),
);

const CATALOG: RuntimeModelCatalog = {
  runtime: "claude",
  allows_custom: false,
  discovery: { status: "ok", detail: "Installed catalog" },
  models: [
    { id: "claude-thorough", label: "Thorough", description: null, source: "discovered" },
    { id: "claude-fast", label: "Fast", description: null, source: "discovered" },
  ],
};

function optionSet(model: string | null): ProviderOptionSet {
  const values = model === "claude-fast" ? ["low", "medium"] : ["high"];
  return {
    runtime: "claude",
    model,
    detection: { status: "ok", detail: "Installed help" },
    options: [
      {
        key: "effort",
        description: "Reasoning effort",
        choices: values.map((value) => ({ value, description: null, dangerous: false })),
        default_value: null,
      },
    ],
  };
}

vi.mock("@web/api/daemon/queries", () => ({
  useRuntimeModels: () => modelCatalogQueryResult(CATALOG),
  useRuntimeProviderOptions: (_runtime: string, model: string | null) =>
    providerOptionSetQueryResult(optionSet(model)),
}));

vi.mock("@web/api/runs/step-mutations", () => ({
  useSetNextTurnModel: () => ({ mutate, isPending: false }),
}));

const CONFIG: ResolvedAgentConfig = {
  runtime: "claude",
  profile_id: "profile-1",
  profile_name: "Implementer",
  model: { id: "claude-thorough", source: "manual" },
  options: { effort: "high", permission_mode: "auto" },
  guidance: null,
  skills: [],
  sources: {
    runtime: "profile",
    model: "profile",
    options: { effort: "profile", permission_mode: "profile" },
  },
  config_hash: "config-current",
};

afterEach(() => {
  mutate.mockClear();
  document.body.replaceChildren();
});

it("keeps an incompatible effort explicit before freezing the next-turn model", async () => {
  const view = await mount(
    <NextTurnModelDialog runId="run-1" stepId="step-1" sessionId="session-1" config={CONFIG} />,
  );

  await act(async () => findButton("claude-thorough")?.click());
  await act(async () => findLabelled("Model for next turn")?.click());
  const fast = [...document.body.querySelectorAll<HTMLElement>("[role='option']")].find(
    (option) => option.textContent?.trim() === "Fast",
  );
  await act(async () => fast?.click());

  expect(document.body.textContent).toContain(
    "Choose an effort compatible with the selected model.",
  );
  expect(findButton("Confirm next turn")?.disabled).toBe(true);

  await act(async () => findLabelled("Effort for next turn")?.click());
  const medium = [...document.body.querySelectorAll<HTMLElement>("[role='option']")].find(
    (option) => option.textContent?.trim() === "medium",
  );
  await act(async () => medium?.click());
  expect(findButton("Confirm next turn")?.disabled).toBe(false);
  await act(async () => findButton("Confirm next turn")?.click());

  expect(mutate).toHaveBeenCalledWith(
    {
      agent_session_id: "session-1",
      current_config_hash: "config-current",
      model: "claude-fast",
      options: { effort: "medium", permission_mode: "auto" },
    },
    expect.anything(),
  );
  await view.cleanup();
});
