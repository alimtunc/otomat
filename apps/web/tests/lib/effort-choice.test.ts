import type {
  AgentProfileContract,
  ProviderOptionDescriptor,
  ProviderOptionSet,
} from "@otomat/domain";
import {
  AGENT_EFFORT_LABEL,
  agentEffort,
  EFFORT_AGENT_DEFAULT_VALUE,
  EFFORT_RUN_VALUE,
  effortChoiceItems,
  effortNote,
  effortSelectionFromValue,
  effortSelectValue,
  resolvedEffortLabel,
  resolveNodeEffort,
  resolveRunEffort,
  RUN_EFFORT_LABEL,
} from "@web/lib/effort-choice";
import { expect, it } from "vitest";

const reasoning: ProviderOptionDescriptor = {
  key: "reasoning_effort",
  description: "How much reasoning effort gpt-5.6-sol spends.",
  choices: ["low", "medium", "high", "ultra"].map((value) => ({
    value,
    description: null,
    dangerous: false,
  })),
  default_value: "medium",
};

function profile(options: AgentProfileContract["options"]): AgentProfileContract {
  return {
    id: "prof",
    name: "Careful",
    runtime: "codex",
    options,
    model: "gpt-5.6-sol",
    guidance: null,
    skill_ids: [],
  };
}

const optionSet = (options: ProviderOptionDescriptor[]): ProviderOptionSet => ({
  runtime: "codex",
  model: "gpt-5.6-sol",
  detection: { status: "ok", detail: "Announced by `codex exec --help`." },
  options,
});

const ANSWERED = { offerRun: true, answered: true };

it("offers only the levels the runtime and model announced, plus the two inherit entries", () => {
  const items = effortChoiceItems(reasoning, undefined, ANSWERED);

  expect(items.map((item) => item.value)).toEqual([
    EFFORT_RUN_VALUE,
    EFFORT_AGENT_DEFAULT_VALUE,
    "low",
    "medium",
    "high",
    "ultra",
  ]);
  expect(items[0]?.label).toBe(RUN_EFFORT_LABEL);
  expect(items[1]?.label).toBe(AGENT_EFFORT_LABEL);
});

it("offers no run entry on the run-level picker, and no level at all when none is announced", () => {
  const items = effortChoiceItems(null, undefined, { offerRun: false, answered: true });

  expect(items.map((item) => item.value)).toEqual([EFFORT_AGENT_DEFAULT_VALUE]);
});

it("keeps a level the current runtime and model dropped in the list, marked", () => {
  const withoutUltra = {
    ...reasoning,
    choices: reasoning.choices.filter((choice) => choice.value !== "ultra"),
  };

  const dropped = effortChoiceItems(withoutUltra, { kind: "level", value: "ultra" }, ANSWERED).find(
    (item) => item.value === "ultra",
  );

  expect(dropped?.stale).toBe(true);
  expect(dropped?.label).toContain("no longer offered");
});

it("does not call a level dropped before the daemon has answered", () => {
  const pending = { offerRun: true, answered: false };

  const items = effortChoiceItems(null, { kind: "level", value: "ultra" }, pending);

  expect(items.find((item) => item.value === "ultra")).toEqual({
    value: "ultra",
    label: "Ultra",
    stale: false,
  });
});

it("round-trips every selection through its select value", () => {
  expect(effortSelectValue(undefined)).toBe(EFFORT_RUN_VALUE);
  expect(effortSelectValue({ kind: "agent_default" })).toBe(EFFORT_AGENT_DEFAULT_VALUE);
  expect(effortSelectValue({ kind: "level", value: "high" })).toBe("high");
  expect(effortSelectionFromValue(EFFORT_RUN_VALUE)).toBeUndefined();
  expect(effortSelectionFromValue(EFFORT_AGENT_DEFAULT_VALUE)).toEqual({ kind: "agent_default" });
  expect(effortSelectionFromValue("ultra")).toEqual({ kind: "level", value: "ultra" });
});

it("reads the agent's own level from whichever key its provider stores it under", () => {
  expect(agentEffort(profile({ reasoning_effort: "high" }))).toEqual({
    level: "high",
    source: "profile",
    profileName: "Careful",
  });
  expect(agentEffort(profile({ effort: "max" })).level).toBe("max");
  expect(agentEffort(profile({}))).toEqual({ level: null, source: "runtime" });
  expect(agentEffort(null)).toEqual({ level: null, source: "runtime" });
});

it("resolves each of the three step choices to a level and the place it came from", () => {
  const agent = agentEffort(profile({ reasoning_effort: "low" }));
  const run = resolveRunEffort({ kind: "level", value: "high" }, agent);

  expect(run).toEqual({ level: "high", source: "run" });
  expect(resolveNodeEffort(undefined, run, agent)).toEqual({ level: "high", source: "run" });
  expect(resolveNodeEffort({ kind: "agent_default" }, run, agent)).toEqual({
    level: "low",
    source: "profile",
    profileName: "Careful",
  });
  expect(resolveNodeEffort({ kind: "level", value: "ultra" }, run, agent)).toEqual({
    level: "ultra",
    source: "step",
  });
});

it("falls back to the agent when the run names no level of its own", () => {
  const agent = agentEffort(profile({ reasoning_effort: "low" }));

  expect(resolveRunEffort({ kind: "agent_default" }, agent)).toBe(agent);
});

it("keeps a step on its own agent's level when the run names none, as the freeze does", () => {
  const run = resolveRunEffort(
    { kind: "agent_default" },
    agentEffort(profile({ reasoning_effort: "low" })),
  );
  const own = agentEffort({ ...profile({ effort: "max" }), name: "Thorough" });

  expect(resolveNodeEffort(undefined, run, own)).toEqual({
    level: "max",
    source: "profile",
    profileName: "Thorough",
  });
});

it("names the effective level and its provenance, and the runtime default it stands in for", () => {
  expect(resolvedEffortLabel({ level: "high", source: "run" }, reasoning)).toBe(
    "High — from the run",
  );
  expect(resolvedEffortLabel({ level: "ultra", source: "step" }, reasoning)).toBe(
    "Ultra — set on this step",
  );
  expect(
    resolvedEffortLabel({ level: "low", source: "profile", profileName: "Careful" }, reasoning),
  ).toBe("Low — from profile “Careful”");
  expect(resolvedEffortLabel({ level: null, source: "runtime" }, reasoning)).toBe(
    "Runtime default — Medium",
  );
  expect(resolvedEffortLabel({ level: null, source: "runtime" }, null)).toBe("Runtime default");
});

it("says where the levels come from, or why there are none", () => {
  expect(effortNote(undefined, null, true, false)).toMatch(/Checking/);
  expect(effortNote(undefined, null, false, true)).toMatch(/could not report/);
  expect(effortNote(optionSet([reasoning]), reasoning, false, false)).toContain(
    "codex exec --help",
  );
  expect(effortNote(optionSet([]), null, false, false)).toMatch(/No effort level is offered/);
});
