// @vitest-environment happy-dom
import type { StepProviderWait, StepRunContract } from "@otomat/domain";
import { ProviderWaitPanel } from "@web/components/runs/provider-wait/panel";
import type { ProviderWaitTarget } from "@web/lib/run/provider-wait";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { findButton } from "#support/dom-queries";
import { mount } from "#support/mount";

const resume = vi.fn();
const schedule = vi.fn();

vi.mock("@web/api/runs/mutations", () => ({
  useResumeRun: () => ({ mutate: resume, isPending: false }),
  useScheduleProviderResume: () => ({ mutate: schedule, mutateAsync: schedule, isPending: false }),
}));

const FUTURE = "2100-01-01T00:00:00.000Z";
const PAST = "2020-01-01T00:00:00.000Z";

const STEP: StepRunContract = {
  id: "step-1",
  run_id: "run-1",
  idx: 0,
  name: "Implement",
  status: "waiting_for_provider",
  compete_group_id: null,
  worktree_id: null,
  branch: null,
  worktree_status: null,
  provider_wait: null,
};

function target(wait: Partial<StepProviderWait> = {}): ProviderWaitTarget {
  return {
    step: STEP,
    wait: {
      provider: "claude",
      reason: "Claude AI usage limit reached|4102444800",
      detected_at: "2026-08-19T12:00:00.000Z",
      provider_resume_at: FUTURE,
      resume_at: FUTURE,
      ...wait,
    },
  };
}

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

it("names the provider's own reset as the provider's, with the reason it gave", async () => {
  await mount(<ProviderWaitPanel runId="run-1" target={target()} />);

  expect(document.body.textContent).toContain("reset time reported by the provider");
  expect(document.body.textContent).toContain("Claude AI usage limit reached|4102444800");
  expect(findButton("Resume now")).toBeDefined();
  expect(findButton("Cancel scheduled resume")).toBeDefined();
  // Nothing to accept: the provider's reset is already what this wait is scheduled for.
  expect(findButton("Resume when available")).toBeUndefined();
});

it("shows a rescheduled wait as the operator's own choice", async () => {
  await mount(
    <ProviderWaitPanel runId="run-1" target={target({ resume_at: "2099-01-01T00:00:00.000Z" })} />,
  );

  expect(document.body.textContent).toContain("time you picked");
});

it("offers the provider's reset once a cancelled schedule left nothing planned", async () => {
  await mount(<ProviderWaitPanel runId="run-1" target={target({ resume_at: null })} />);

  expect(document.body.textContent).toContain("No resume scheduled");
  expect(findButton("Cancel scheduled resume")).toBeUndefined();
  const accept = findButton("Resume when available");
  expect(accept).toBeDefined();

  await act(async () => accept?.click());
  expect(schedule).toHaveBeenCalledWith(FUTURE);
});

it("never offers a reset that has already passed", async () => {
  await mount(
    <ProviderWaitPanel
      runId="run-1"
      target={target({ provider_resume_at: PAST, resume_at: null })}
    />,
  );

  expect(findButton("Resume when available")).toBeUndefined();
  expect(findButton("Resume now")).toBeDefined();
});

it("cancels the schedule without ending the wait", async () => {
  await mount(<ProviderWaitPanel runId="run-1" target={target()} />);

  await act(async () => findButton("Cancel scheduled resume")?.click());

  expect(schedule).toHaveBeenCalledWith(null);
});

it("captures the opening time for an operator-defined schedule", async () => {
  await mount(
    <ProviderWaitPanel
      runId="run-1"
      target={target({ provider_resume_at: null, resume_at: null })}
    />,
  );

  await act(async () => findButton("Change schedule…")?.click());

  const input = document.querySelector<HTMLInputElement>('input[aria-label="Resume at"]');
  expect(input?.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

  await act(async () => findButton("Keep waiting")?.click());
  expect(document.querySelector('input[aria-label="Resume at"]')).toBeNull();
});

it("resumes now on the operator's own action", async () => {
  await mount(<ProviderWaitPanel runId="run-1" target={target()} />);

  await act(async () => findButton("Resume now")?.click());

  expect(resume).toHaveBeenCalled();
});
