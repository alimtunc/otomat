// @vitest-environment happy-dom
import type { RunDetail, RunResumePlan, RunState } from "@otomat/domain";
import { RunActionsMenu } from "@web/components/runs/actions/run-actions-menu";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { findButton } from "#support/dom-queries";
import { mount } from "#support/mount";

const resume = vi.fn();
const abort = vi.fn();
let detail: RunDetail | undefined;

vi.mock("@web/api/runs/mutations", () => ({
  useResumeRun: () => ({ mutate: resume, isPending: false }),
  useAbortRun: () => ({ mutate: abort, isPending: false }),
  useAbandonWorkspace: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@web/api/runs/queries", () => ({
  useRunDetail: () => ({ data: detail }),
  useRunWorkspace: () => ({ data: undefined, isPending: true, isError: false, refetch: vi.fn() }),
}));

function runDetail(status: RunState, plan: RunResumePlan, holdsWorkspace = true): RunDetail {
  return {
    run: {
      id: "run-1",
      issue_id: "issue-1",
      status,
      branch: "otomat/run/run-1",
      plan_json: { version: 1, steps: [] },
      updated_at: "2026-08-11T10:00:00.000Z",
    },
    steps: [],
    sessions: [],
    compete_groups: [],
    worktree_path: "/tmp/wt",
    base_branch: "main",
    wait: null,
    resume: plan,
    holds_workspace: holdsWorkspace,
  };
}

afterEach(() => {
  detail = undefined;
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

it("leads a stopped run with Resume and names the fallback before it runs", async () => {
  detail = runDetail("failed", { mode: "recovery", reason: "No provider session was recorded" });
  const mounted = await mount(<RunActionsMenu runId="run-1" />);

  const button = findButton("Resume run");
  expect(button).toBeDefined();
  expect(button?.disabled).toBe(false);
  expect(button?.title).toContain("No provider session was recorded");
  expect(button?.title).toContain("same step and worktree");

  await act(async () => button?.click());
  expect(resume).toHaveBeenCalledTimes(1);

  await mounted.cleanup();
});

it("disables Resume with the daemon's reason when it would be refused", async () => {
  detail = runDetail("canceled", {
    mode: "unavailable",
    reason: "This run no longer holds its issue's workspace",
  });
  const mounted = await mount(<RunActionsMenu runId="run-1" />);

  const button = findButton("Resume run");
  expect(button?.disabled).toBe(true);
  expect(button?.title).toBe("This run no longer holds its issue's workspace");

  await mounted.cleanup();
});

it("offers no Resume on a merged run", async () => {
  detail = runDetail("completed", { mode: "unavailable", reason: "A completed run has no turn" });
  const mounted = await mount(<RunActionsMenu runId="run-1" />);

  expect(findButton("Resume run")).toBeUndefined();

  await mounted.cleanup();
});
