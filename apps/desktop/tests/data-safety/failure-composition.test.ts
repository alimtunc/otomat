import { expect, it } from "vitest";

import { combineFailures } from "#main/data-safety/failure-composition";

it("keeps a single failure unchanged and aggregates multiple failures", () => {
  const primary = new Error("primary");
  const cleanup = new Error("cleanup");

  expect(combineFailures([primary], "unused")).toBe(primary);
  expect(combineFailures([primary, cleanup], "operation failed")).toEqual(
    new AggregateError([primary, cleanup], "operation failed"),
  );
});
