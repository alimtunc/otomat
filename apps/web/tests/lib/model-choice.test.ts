import type { RunPlan } from "@otomat/domain";
import {
  catalogNote,
  isCompleteModelSelection,
  MODEL_CUSTOM_VALUE,
  MODEL_INHERIT_VALUE,
  MODEL_PROVIDER_DEFAULT_VALUE,
  modelChoiceItems,
  modelSelectValue,
  requestedRunModels,
  resolvedModelLabel,
} from "@web/lib/model-choice";
import { expect, it } from "vitest";

import { modelCatalog } from "#support/runtime-models";

const catalog = modelCatalog();

const values = (items: { value: string }[]) => items.map((item) => item.value);

it("maps every selection to the select entry that represents it", () => {
  expect(modelSelectValue(undefined, catalog)).toBe(MODEL_INHERIT_VALUE);
  expect(modelSelectValue({ kind: "provider_default" }, catalog)).toBe(
    MODEL_PROVIDER_DEFAULT_VALUE,
  );
  expect(modelSelectValue({ kind: "model", id: "opus" }, catalog)).toBe("opus");
  // An id the catalog does not list is a custom identifier, never silently shown as a listed one.
  expect(modelSelectValue({ kind: "model", id: "claude-fable-5" }, catalog)).toBe(
    MODEL_CUSTOM_VALUE,
  );
});

it("blocks submitting a model identifier the daemon would refuse", () => {
  expect(isCompleteModelSelection(undefined)).toBe(true);
  expect(isCompleteModelSelection({ kind: "provider_default" })).toBe(true);
  expect(isCompleteModelSelection({ kind: "model", id: "opus" })).toBe(true);
  expect(isCompleteModelSelection({ kind: "model", id: "" })).toBe(false);
  expect(isCompleteModelSelection({ kind: "model", id: "--flagged" })).toBe(false);
});

it("assembles the picker entries in display order, custom staying reachable when selected", () => {
  expect(values(modelChoiceItems(catalog, { inheritLabel: "Inherit", selected: "opus" }))).toEqual([
    MODEL_INHERIT_VALUE,
    MODEL_PROVIDER_DEFAULT_VALUE,
    "opus",
    MODEL_CUSTOM_VALUE,
  ]);
  expect(values(modelChoiceItems(catalog, { selected: "opus" }))).toEqual([
    MODEL_PROVIDER_DEFAULT_VALUE,
    "opus",
    MODEL_CUSTOM_VALUE,
  ]);
  const closed = modelCatalog({ allows_custom: false });
  expect(values(modelChoiceItems(closed, { selected: "opus" }))).toEqual([
    MODEL_PROVIDER_DEFAULT_VALUE,
    "opus",
  ]);
  // A stored custom identifier still owns the trigger even when the catalog stopped allowing custom entries.
  expect(values(modelChoiceItems(closed, { selected: MODEL_CUSTOM_VALUE }))).toEqual([
    MODEL_PROVIDER_DEFAULT_VALUE,
    "opus",
    MODEL_CUSTOM_VALUE,
  ]);
});

it("explains the catalog's provenance, or why nothing is listed", () => {
  expect(catalogNote(undefined, true, false)).toBe("Checking the installed runtime…");
  expect(catalogNote(undefined, false, true)).toBe(
    "The model catalog could not be read, so only Default is offered.",
  );
  expect(catalogNote(undefined, false, false)).toBeNull();
  expect(catalogNote(modelCatalog({ models: [], allows_custom: false }), false, false)).toBe(
    "This runtime takes no model selection.",
  );
  expect(catalogNote(catalog, false, false)).toBe(catalog.discovery.detail);
});

it("labels a frozen model by its identifier alone, and the provider default as Default", () => {
  expect(resolvedModelLabel(null)).toBe("Default");
  expect(resolvedModelLabel({ id: "gpt-5.6-sol", source: "discovered" })).toBe("gpt-5.6-sol");
  expect(resolvedModelLabel({ id: "claude-fable-5", source: "manual" })).toBe("claude-fable-5");
});

it("collects the distinct models a run froze, competitors included", () => {
  const config = {
    runtime: "fake",
    profile_id: null,
    profile_name: null,
    options: {},
    guidance: null,
    skills: [],
    config_hash: "h",
  };
  const plan: RunPlan = {
    version: 1,
    steps: [
      {
        id: "s1",
        name: "One",
        agent: "fake",
        prompt: "a",
        depends_on: [],
        config: { ...config, model: { id: "fake-fast", source: "static" } },
      },
      {
        id: "s2",
        name: "Two",
        agent: "fake",
        prompt: "b",
        depends_on: [],
        config: { ...config, model: { id: "fake-fast", source: "static" } },
      },
      {
        id: "g1",
        name: "Group",
        depends_on: [],
        compete: [
          { id: "c1", name: "A", agent: "fake", prompt: "x", config: { ...config, model: null } },
          {
            id: "c2",
            name: "B",
            agent: "fake",
            prompt: "y",
            config: { ...config, model: { id: "fake-thorough", source: "static" } },
          },
        ],
      },
    ],
  };

  expect(requestedRunModels(plan)).toEqual([
    { id: "fake-fast", source: "static" },
    null,
    { id: "fake-thorough", source: "static" },
  ]);
});

it("reads a run frozen before model selection existed as the provider default", () => {
  const plan: RunPlan = {
    version: 1,
    steps: [{ id: "s1", name: "One", agent: "fake", prompt: "a", depends_on: [] }],
  };
  expect(requestedRunModels(plan)).toEqual([null]);
});
