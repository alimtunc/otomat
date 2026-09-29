// @vitest-environment happy-dom
import type {
  ProviderOptionSet,
  ResolvedAgentConfig,
  RunDetail,
  RuntimeDescriptor,
} from "@otomat/domain";
import { NextTurnMenu } from "@web/components/runs/conversation/next-turn/menu";
import { runDetailFixture } from "@web/gallery/gallery.fixtures";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { runtimeDescriptor } from "#support/agent";
import { CODEX_ANNOUNCED } from "#support/announced-options";
import { findMenuItem } from "#support/dom-queries";
import { mountWithQuery } from "#support/mount";
import { modelCatalog, modelCatalogQueryResult } from "#support/runtime-models";
import { providerOptionSet, providerOptionSetQueryResult } from "#support/runtime-options";

const mutate = vi.fn();
const toastError = vi.fn();

const CATALOG = modelCatalog({
  allows_custom: false,
  discovery: { status: "ok", detail: "Installed catalog" },
  models: ["Thorough", "Deep", "Fast", "Plain", "Broken", "Slow"].map((label) => ({
    id: `claude-${label.toLowerCase()}`,
    label,
    description: null,
    source: "discovered" as const,
  })),
});

const EFFORTS = new Map([
  ["claude-fast", ["low", "medium"]],
  ["claude-deep", ["high", "max"]],
  ["claude-plain", []],
]);

function optionSet(runtime: string, model: string | null): ProviderOptionSet {
  if (runtime === "codex") return CODEX_ANNOUNCED;
  const efforts = EFFORTS.get(model ?? "") ?? ["high"];
  return providerOptionSet({
    model,
    detection: { status: "ok", detail: "Installed help" },
    options:
      efforts.length === 0
        ? []
        : [
            {
              key: "effort",
              description: "Reasoning effort",
              choices: efforts.map((value) => ({ value, description: null, dangerous: false })),
              default_value: null,
            },
          ],
  });
}

let resumeModel: RuntimeDescriptor["capabilities"]["resume_model"] = { status: "supported" };

vi.mock("@otomat/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@otomat/ui")>()),
  toast: { success: vi.fn(), error: (...args: unknown[]) => toastError(...args) },
}));

vi.mock("@web/api/daemon/queries", () => ({
  useRuntimes: () => ({
    isPending: false,
    isError: false,
    data: ["claude", "codex"].map((id) =>
      runtimeDescriptor({
        id,
        display_name: id,
        capabilities: { ...runtimeDescriptor().capabilities, resume_model: resumeModel },
      }),
    ),
  }),
  useRuntimeModels: () => modelCatalogQueryResult(CATALOG),
  useRuntimeProviderOptions: (runtime: string, model: string | null) =>
    providerOptionSetQueryResult(optionSet(runtime, model)),
  providerOptionSetOptions: (_keys: unknown, runtime: string, model: string | null) => ({
    queryKey: ["options", runtime, model],
    queryFn: () => {
      if (model === "claude-broken") throw new Error("unreadable");
      if (model === "claude-slow") return new Promise<never>(() => {});
      return optionSet(runtime, model);
    },
  }),
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

function detailWith(
  config: ResolvedAgentConfig,
  pending: ResolvedAgentConfig | null = null,
): RunDetail {
  const detail = runDetailFixture("awaiting_human", [{ id: "step-1", status: "awaiting_human" }]);
  return {
    ...detail,
    steps: detail.steps.map((step) => ({ ...step, next_turn_config: pending })),
    sessions: [
      {
        id: "session-1",
        step_run_id: "step-1",
        kind: "step",
        agent_id: config.runtime,
        status: "awaiting_input",
        provider_session_id: "provider-1",
        resumed_from_session_id: null,
        config,
        reported_model: null,
        started_at: "2026-08-30T10:00:00.000Z",
        boundary: {
          start_tree_sha: null,
          start_head_sha: null,
          end_tree_sha: null,
          end_head_sha: null,
          error: null,
        },
      },
    ],
  };
}

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  mutate.mockClear();
  toastError.mockClear();
  resumeModel = { status: "supported" };
});

async function render(detail: RunDetail = detailWith(CONFIG)) {
  const mounted = await mountWithQuery(<NextTurnMenu detail={detail} stepRunId="step-1" />);
  cleanups.push(mounted.cleanup);
}

async function click(selector: string): Promise<void> {
  const target = document.querySelector<HTMLElement>(selector);
  if (!target) throw new Error(`${selector} not found`);
  await act(async () => target.click());
}

async function choose(label: string): Promise<void> {
  const choice = [...document.querySelectorAll<HTMLElement>("[role='menuitemradio']")].find(
    (item) => item.textContent?.startsWith(label),
  );
  if (!choice) throw new Error(`${label} choice not found`);
  await act(async () => choice.click());
  // The pick reads the model's announced options before it applies.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function openModels(): Promise<void> {
  await click("[aria-label^='Next turn:']");
  await click("[aria-label^='Model:']");
}

it("names the next turn's model and effort on the composer control", async () => {
  await render();

  expect(document.querySelector("[aria-label='Next turn: Thorough · high']")).not.toBeNull();
});

it("applies a model at once when it offers the current effort", async () => {
  await render();
  await openModels();
  await choose("Deep");

  expect(mutate).toHaveBeenCalledWith(
    {
      agent_session_id: "session-1",
      current_config_hash: "config-current",
      model: "claude-deep",
      options: { effort: "high", permission_mode: "auto" },
    },
    expect.anything(),
  );
});

it("writes nothing when the current model is picked again", async () => {
  await render();
  await openModels();
  await choose("Thorough");

  expect(mutate).not.toHaveBeenCalled();
});

it("holds a model that does not offer the current effort until a compatible one is chosen", async () => {
  await render();
  await openModels();
  await choose("Fast");

  expect(mutate).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("Fast does not offer effort high");

  await click("[aria-label^='Effort:']");
  await choose("Medium");

  expect(mutate).toHaveBeenCalledWith(
    {
      agent_session_id: "session-1",
      current_config_hash: "config-current",
      model: "claude-fast",
      options: { effort: "medium", permission_mode: "auto" },
    },
    expect.anything(),
  );
});

it("drops the effort only when asked, for a model that offers none", async () => {
  await render();
  await openModels();
  await choose("Plain");

  expect(mutate).not.toHaveBeenCalled();
  const drop = findMenuItem("Switch without an effort");
  if (!drop) throw new Error("Switch without an effort not found");
  await act(async () => drop.click());

  expect(mutate).toHaveBeenCalledWith(
    expect.objectContaining({ model: "claude-plain", options: { permission_mode: "auto" } }),
    expect.anything(),
  );
});

it("changes nothing and says so when a model's efforts cannot be read", async () => {
  await render();
  await openModels();
  await choose("Broken");

  expect(mutate).not.toHaveBeenCalled();
  expect(toastError).toHaveBeenCalledWith(expect.stringContaining("Broken"));
  expect(document.body.textContent).not.toContain("does not offer effort");
});

it("ignores another pick while the previous one is still reading its model", async () => {
  await render();
  await openModels();
  await choose("Slow");
  await choose("Deep");

  expect(mutate).not.toHaveBeenCalled();
});

it("revises an already revised next turn against its pending configuration", async () => {
  const pending: ResolvedAgentConfig = {
    ...CONFIG,
    model: { id: "claude-deep", source: "manual" },
    config_hash: "config-pending",
  };
  await render(detailWith(CONFIG, pending));

  expect(document.querySelector("[aria-label='Next turn: Deep · high']")).not.toBeNull();

  await click("[aria-label^='Next turn:']");
  await click("[aria-label^='Effort:']");
  await choose("Max");

  expect(mutate).toHaveBeenCalledWith(
    {
      agent_session_id: "session-1",
      current_config_hash: "config-pending",
      model: "claude-deep",
      options: { effort: "max", permission_mode: "auto" },
    },
    expect.anything(),
  );
});

it("keeps the frozen configuration and says why when the runtime cannot change model", async () => {
  resumeModel = { status: "unsupported", reason: "This version cannot resume with a model." };
  await render();
  await click("[aria-label^='Next turn:']");

  expect(document.body.textContent).toContain("This version cannot resume with a model.");
  expect(document.body.textContent).toContain("Add a follow-up step");
  expect(document.querySelector("[aria-label^='Model:']")).toBeNull();
});

it("replaces legacy Codex permissions with one approval mode for the next turn", async () => {
  await render(
    detailWith({
      ...CONFIG,
      runtime: "codex",
      model: null,
      options: { sandbox: "workspace-write", approval_policy: "never" },
    }),
  );
  await click("[aria-label^='Approval mode for next turn']");
  await click("[aria-label^='Approval mode:']");
  await choose("Approve for me");

  expect(mutate).toHaveBeenCalledWith(
    expect.objectContaining({ model: null, options: { approval_mode: "approve_for_me" } }),
    expect.anything(),
  );
});
