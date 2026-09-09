import { expect, it } from "vitest";

import type { LocalWorkItem, LocalWorkState } from "#main/background/work-items";
import { localWorkLines } from "#main/background/work-lines";

function item(state: LocalWorkState, runId = `run-${state}`): LocalWorkItem {
  return {
    run_id: runId,
    project: "Otomat",
    issue: "OTO-1",
    state,
    started_at: "2026-09-03T10:00:00.000Z",
  };
}

it("counts working runs, runs blocked on the operator, and failures apart", () => {
  const items = [item("running", "a"), item("running", "b"), item("waiting"), item("failed")];

  expect(localWorkLines(items)).toEqual(["2 runs active", "1 awaiting you", "1 failed"]);
});

it("names each count once, singular or plural", () => {
  expect(localWorkLines([item("running"), item("failed"), item("failed", "b")])).toEqual([
    "1 run active",
    "0 awaiting you",
    "2 failed",
  ]);
});

it("says the activity is unreadable rather than reporting a count it does not have", () => {
  expect(localWorkLines(null)).toEqual(["Otomat could not read the local daemon's activity."]);
});
