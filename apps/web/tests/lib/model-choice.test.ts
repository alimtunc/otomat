import { EXECUTION_INHERIT_VALUE } from "@web/lib/execution/selection";
import {
  catalogNote,
  frozenModelLabel,
  isCompleteModelSelection,
  MODEL_CUSTOM_VALUE,
  MODEL_PROVIDER_DEFAULT_VALUE,
  modelChoiceItems,
  modelSelectValue,
} from "@web/lib/model-choice";
import { expect, it } from "vitest";

import { modelCatalog } from "#support/runtime-models";

const catalog = modelCatalog();

const values = (items: { value: string }[]) => items.map((item) => item.value);

const items = (options: Partial<Parameters<typeof modelChoiceItems>[1]> = {}) =>
  modelChoiceItems(catalog, {
    inheritLabel: "Inherit",
    offerProviderDefault: true,
    selected: "opus",
    ...options,
  });

it("maps every selection to the entry that represents it", () => {
  expect(modelSelectValue(undefined, catalog)).toBe(EXECUTION_INHERIT_VALUE);
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
  expect(values(items())).toEqual([
    EXECUTION_INHERIT_VALUE,
    MODEL_PROVIDER_DEFAULT_VALUE,
    "opus",
    MODEL_CUSTOM_VALUE,
  ]);
  const closed = modelCatalog({ allows_custom: false });
  expect(
    values(
      modelChoiceItems(closed, {
        inheritLabel: "Inherit",
        offerProviderDefault: true,
        selected: "opus",
      }),
    ),
  ).toEqual([EXECUTION_INHERIT_VALUE, MODEL_PROVIDER_DEFAULT_VALUE, "opus"]);
  // A stored custom identifier still owns the trigger even when the catalog stopped allowing custom entries.
  expect(
    values(
      modelChoiceItems(closed, {
        inheritLabel: "Inherit",
        offerProviderDefault: true,
        selected: MODEL_CUSTOM_VALUE,
      }),
    ),
  ).toContain(MODEL_CUSTOM_VALUE);
});

it("omits the provider default where the selection is stored rather than overridden", () => {
  expect(values(items({ offerProviderDefault: false }))).toEqual([
    EXECUTION_INHERIT_VALUE,
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
  expect(frozenModelLabel(null)).toBe("Default");
  expect(frozenModelLabel({ id: "gpt-5.6-sol", source: "discovered" })).toBe("gpt-5.6-sol");
  expect(frozenModelLabel({ id: "claude-fable-5", source: "manual" })).toBe("claude-fable-5");
});
