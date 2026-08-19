import { NO_USAGE_FILTERS, type UsageFacetOptions } from "@otomat/domain";
import {
  activeUsageChips,
  activeUsageFilterCount,
  clearedUsageFilters,
  usageEmitterLabel,
  usageModelOptions,
  withoutUsageChip,
} from "@web/lib/usage/facets";
import { expect, it } from "vitest";

const OPTIONS: UsageFacetOptions = {
  projects: [{ id: "p1", name: "First" }],
  emitters: [
    { runtime: "claude", model: "claude-opus-5" },
    { runtime: "codex", model: null },
  ],
  issues: [{ id: "i1", identifier: "OTO-1", title: "Dashboard" }],
};

it("names an axis the provider never reported instead of showing it empty", () => {
  expect(usageEmitterLabel({ runtime: "codex", model: null })).toBe("codex · Model not reported");
  expect(usageModelOptions(OPTIONS)).toEqual([
    { value: "claude-opus-5", label: "claude-opus-5" },
    { value: "", label: "Model not reported" },
  ]);
});

it("shows one removable chip per selected value", () => {
  const filters = { ...NO_USAGE_FILTERS, day: "2026-08-10", projects: ["p1"], issues: ["i1"] };

  const chips = activeUsageChips(filters, OPTIONS);

  expect(chips.map((chip) => chip.label)).toEqual(["2026-08-10", "First", "OTO-1 · Dashboard"]);
  expect(activeUsageFilterCount(filters)).toBe(3);
  expect(withoutUsageChip(filters, chips[1]).projects).toEqual([]);
});

it("keeps the window when every other axis is cleared", () => {
  const cleared = clearedUsageFilters({ ...NO_USAGE_FILTERS, period: "90d", projects: ["p1"] });

  expect(cleared).toEqual({ ...NO_USAGE_FILTERS, period: "90d" });
});
