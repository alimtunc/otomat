import type { RunContract } from "@otomat/domain";
import { isActiveRun, resolveFollowedRun } from "@web/lib/run-activity";
import { expect, it } from "vitest";

function run(id: string, status: RunContract["status"]): RunContract {
  return {
    id,
    issue_id: "i1",
    status,
    branch: `otomat/run/${id}`,
    plan_json: { version: 1, steps: [] },
  };
}

it("treats non-terminal runs as active", () => {
  expect(isActiveRun(run("r1", "running"))).toBe(true);
  expect(isActiveRun(run("r1", "review_ready"))).toBe(true);
  expect(isActiveRun(run("r1", "completed"))).toBe(false);
  expect(isActiveRun(run("r1", "failed"))).toBe(false);
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
