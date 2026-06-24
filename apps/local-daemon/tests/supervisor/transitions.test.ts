import { runMachine } from "@otomat/domain";
import { expect, it } from "vitest";

import { shortestPath } from "#supervisor";

it("returns a single-hop path for a direct edge", () => {
  expect(shortestPath(runMachine, "running", "review_ready")).toEqual(["review_ready"]);
});

it("routes through running to reach awaiting_human from awaiting_permission", () => {
  expect(shortestPath(runMachine, "awaiting_permission", "awaiting_human")).toEqual([
    "running",
    "awaiting_human",
  ]);
});

it("returns an empty path when already at the target", () => {
  expect(shortestPath(runMachine, "running", "running")).toEqual([]);
});

it("returns null when the target is unreachable from a terminal state", () => {
  expect(shortestPath(runMachine, "completed", "running")).toBeNull();
});
