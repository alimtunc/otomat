import { describe, expect, it } from "vitest";

import { executionLevels, globalLevel, overrideLevel, storedLevel } from "#domain/execution/levels";
import {
  resolveExecutionModel,
  resolveExecutionOption,
  selectedOptionKeys,
} from "#domain/execution/resolve";

const defaults = { runtime: "claude", model: "opus", options: { effort: "low" } };
const profile = { model: "sonnet", options: { permission_mode: "plan" } };

function levels(step = {}, launch = {}) {
  return [
    overrideLevel("step", step),
    overrideLevel("launch", launch),
    storedLevel("profile", profile),
    storedLevel("global", defaults),
  ];
}

describe("resolveExecutionOption", () => {
  it("answers with the most specific level that names a value", () => {
    const own = levels({ options: { effort: { kind: "value", value: "high" } } });
    expect(resolveExecutionOption(own, "effort")).toEqual({ value: "high", source: "step" });
    expect(
      resolveExecutionOption(
        levels({}, { options: { effort: { kind: "value", value: "medium" } } }),
        "effort",
      ),
    ).toEqual({ value: "medium", source: "launch" });
    expect(resolveExecutionOption(levels(), "permission_mode")).toEqual({
      value: "plan",
      source: "profile",
    });
    expect(resolveExecutionOption(levels(), "effort")).toEqual({ value: "low", source: "global" });
  });

  it("answers `provider` when no level selects anything, so no argument is sent", () => {
    const none = resolveExecutionOption(levels(), "sandbox");
    expect(none).toEqual({ value: null, source: "provider" });
  });

  it("skips every override above the agent when a step declines by name", () => {
    const declined = levels(
      { options: { effort: { kind: "agent_default" } } },
      { options: { effort: { kind: "value", value: "medium" } } },
    );
    expect(resolveExecutionOption(declined, "effort")).toEqual({ value: "low", source: "global" });
  });
});

describe("resolveExecutionModel", () => {
  it("prefers an override, then the profile, then the host defaults", () => {
    expect(resolveExecutionModel(levels({ model: { kind: "model", id: "haiku" } }))).toEqual({
      value: { kind: "model", id: "haiku" },
      source: "step",
    });
    expect(resolveExecutionModel(levels())).toEqual({
      value: { kind: "model", id: "sonnet" },
      source: "profile",
    });
    expect(resolveExecutionModel([storedLevel("global", defaults)])).toEqual({
      value: { kind: "model", id: "opus" },
      source: "global",
    });
  });

  it("lets an override ask for the provider's own default, which a saved configuration cannot", () => {
    expect(resolveExecutionModel(levels({ model: { kind: "provider_default" } }))).toEqual({
      value: { kind: "provider_default" },
      source: "step",
    });
    expect(resolveExecutionModel([storedLevel("profile", { model: null, options: {} })])).toEqual({
      value: null,
      source: "provider",
    });
  });
});

describe("selectedOptionKeys", () => {
  it("names only the keys some level selects, in the canonical option order", () => {
    expect(selectedOptionKeys(levels())).toEqual(["permission_mode", "effort"]);
    expect(selectedOptionKeys([overrideLevel("step", {})])).toEqual([]);
  });
});

describe("globalLevel", () => {
  it("applies to the runtime it names and to no other", () => {
    expect(globalLevel(defaults, "claude")?.source).toBe("global");
    expect(globalLevel(defaults, "codex")).toBeNull();
    expect(globalLevel({ runtime: null, model: null, options: {} }, "claude")).toBeNull();
  });
});

describe("executionLevels", () => {
  it("orders overrides above the profile, and the profile above the host defaults", () => {
    const ordered = executionLevels([overrideLevel("launch", {})], profile, defaults, "claude");
    expect(ordered.map((level) => level.source)).toEqual(["launch", "profile", "global"]);
  });

  it("leaves out an absent profile and host defaults that name another runtime", () => {
    const ordered = executionLevels([overrideLevel("launch", {})], null, defaults, "codex");
    expect(ordered.map((level) => level.source)).toEqual(["launch"]);
  });
});
