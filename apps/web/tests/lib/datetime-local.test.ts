import { fromDateTimeLocal, toDateTimeLocal } from "@web/lib/datetime-local";
import { expect, it } from "vitest";

// The field speaks local wall time with no zone, so the round trip has to go through the browser's own offset.
it("round-trips an instant through a datetime-local value", () => {
  const instant = new Date("2026-08-19T15:30:00.000Z");
  const local = toDateTimeLocal(instant);

  expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  expect(fromDateTimeLocal(local)).toBe(instant.toISOString());
});

it("names no instant for a value that is not one", () => {
  expect(fromDateTimeLocal("")).toBeNull();
  expect(fromDateTimeLocal("tomorrow")).toBeNull();
});
