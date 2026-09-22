import {
  DEFAULT_STEP_SCHEDULE,
  scheduleCandidates,
  scheduleReady,
  scheduleRequestFields,
} from "@web/lib/run/step-schedule";
import { expect, it } from "vitest";

import { chainRunDetail } from "#support/run";

it("reads the run detail into the nodes the appended step may wait on", () => {
  const candidates = scheduleCandidates(
    chainRunDetail({ implement: "succeeded", review: "withdrawn" }),
  );

  expect(candidates.map(({ node, succeeded }) => [node.id, succeeded])).toEqual([
    ["implement", true],
  ]);
});

it("waits on the last candidate by default, on the chosen one otherwise, and on nothing when none is left", () => {
  const candidates = scheduleCandidates(chainRunDetail({ implement: "succeeded" }));

  expect(scheduleRequestFields(DEFAULT_STEP_SCHEDULE, candidates)).toEqual({
    depends_on: ["polish"],
    parallel: false,
  });
  expect(
    scheduleRequestFields({ ...DEFAULT_STEP_SCHEDULE, after: "implement" }, candidates),
  ).toEqual({ depends_on: ["implement"], parallel: false });
  expect(scheduleRequestFields(DEFAULT_STEP_SCHEDULE, [])).toEqual({
    depends_on: [],
    parallel: false,
  });
});

it("sends a parallel step with no dependency, and only once the operator confirmed", () => {
  const parallel = { mode: "parallel" as const, after: null, confirmed: false };

  expect(scheduleReady(parallel)).toBe(false);
  expect(scheduleReady({ ...parallel, confirmed: true })).toBe(true);
  expect(scheduleReady(DEFAULT_STEP_SCHEDULE)).toBe(true);
  expect(scheduleRequestFields({ ...parallel, confirmed: true }, [])).toEqual({
    depends_on: [],
    parallel: true,
  });
});
