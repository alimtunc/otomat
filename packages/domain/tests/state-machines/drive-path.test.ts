import { expect, it } from "vitest";

import { drivePath, IllegalTransitionError } from "#domain/state-machines/machine";
import { runMachine } from "#domain/state-machines/run";

it("applies each state along the path in order", () => {
  const applied: string[] = [];
  drivePath(runMachine, "awaiting_permission", "awaiting_human", (state) => applied.push(state));
  expect(applied).toEqual(["running", "awaiting_human"]);
});

it("applies nothing when already at the target", () => {
  const applied: string[] = [];
  drivePath(runMachine, "running", "running", (state) => applied.push(state));
  expect(applied).toEqual([]);
});

it("throws IllegalTransitionError without applying when the target is unreachable", () => {
  const applied: string[] = [];
  let caught: unknown;
  try {
    drivePath(runMachine, "completed", "running", (state) => applied.push(state));
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(IllegalTransitionError);
  const error = caught as IllegalTransitionError;
  expect(error.machine).toBe(runMachine.name);
  expect(error.from).toBe("completed");
  expect(error.to).toBe("running");
  expect(applied).toEqual([]);
});
