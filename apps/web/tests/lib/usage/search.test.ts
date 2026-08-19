import { NO_USAGE_FILTERS } from "@otomat/domain";
import {
  parseUsageSearch,
  usageFiltersFromSearch,
  usageSearchFromFilters,
} from "@web/lib/usage/search";
import { expect, it } from "vitest";

it("keeps only what narrows the default out of the URL", () => {
  expect(usageSearchFromFilters(NO_USAGE_FILTERS)).toEqual({
    period: undefined,
    day: undefined,
    projects: undefined,
    runtimes: undefined,
    models: undefined,
    issues: undefined,
  });
});

it("round-trips every axis a reader can share", () => {
  const filters = {
    ...NO_USAGE_FILTERS,
    period: "7d" as const,
    day: "2026-08-10",
    projects: ["p1"],
    models: [""],
  };

  expect(usageFiltersFromSearch(parseUsageSearch(usageSearchFromFilters(filters)))).toEqual(
    filters,
  );
});

it("ignores an axis the URL cannot be read as, one axis at a time", () => {
  const search = parseUsageSearch({ period: "forever", day: "yesterday", projects: ["p1", "p1"] });

  expect(usageFiltersFromSearch(search)).toEqual({ ...NO_USAGE_FILTERS, projects: ["p1"] });
});
