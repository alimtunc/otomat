import type { RunContract } from "@otomat/domain";
import { isActiveRun, isRunWorking, resolveFollowedRun } from "@web/lib/run-activity";
import { expect, it } from "vitest";

function run(id: string, status: RunContract["status"]): RunContract {
  return {
    id,
    issue_id: "i1",
    status,
    branch: `otomat/run/${id}`,
    plan_json: { version: 1, steps: [] },
    updated_at: "2026-07-25T10:00:00.000Z",
  };
}

it("treats non-terminal runs as active", () => {
  expect(isActiveRun(run("r1", "running"))).toBe(true);
  expect(isActiveRun(run("r1", "review_ready"))).toBe(true);
  expect(isActiveRun(run("r1", "completed"))).toBe(false);
  expect(isActiveRun(run("r1", "failed"))).toBe(false);
});

it("separates a run that is working from one that is merely active", () => {
  expect(isRunWorking(run("r1", "running"))).toBe(true);
  expect(isRunWorking(run("r1", "preparing"))).toBe(true);
  // Resting on a human: still active, but no provider turn is in flight.
  expect(isRunWorking(run("r1", "awaiting_human"))).toBe(false);
  expect(isRunWorking(run("r1", "review_ready"))).toBe(false);
  expect(isRunWorking(run("r1", "completed"))).toBe(false);
});

it("keeps the user's pick while it is still listed", () => {
  const runs = [run("r1", "completed"), run("r2", "running")];
  expect(resolveFollowedRun(runs, "r1")?.id).toBe("r1");
});

it("falls back to the first active run, then the most recent, then null", () => {
  expect(resolveFollowedRun([run("r1", "completed"), run("r2", "running")], null)?.id).toBe("r2");
  expect(resolveFollowedRun([run("r1", "completed"), run("r2", "failed")], "gone")?.id).toBe("r2");
  expect(resolveFollowedRun([], null)).toBeNull();
});
