// @vitest-environment happy-dom
import { RunClosureBar } from "@web/components/runs/conversation/closure-bar";
import { runDetailFixture } from "@web/gallery/gallery.fixtures";
import { afterEach, describe, expect, it, vi } from "vitest";

import { click } from "#support/dom-events";
import { findButton } from "#support/dom-queries";
import { mount } from "#support/mount";

const resume = vi.fn();

vi.mock("@web/components/runs/actions/add-step-dialog", () => ({
  AddStepDialog: () => <button type="button">Add follow-up step</button>,
}));

vi.mock("@web/components/runs/conversation/next-turn/menu", () => ({
  NextTurnMenu: () => <button type="button">Next turn</button>,
}));

vi.mock("@web/api/runs/mutations", () => ({
  useResumeRun: () => ({ mutate: resume, isPending: false }),
}));

afterEach(() => resume.mockClear());

describe("RunClosureBar", () => {
  it("closes a finished run with the follow-up step as the only control", async () => {
    const view = await mount(
      <RunClosureBar detail={runDetailFixture("completed")} stepRunId="step-1" />,
    );
    expect(view.container.querySelector('[role="status"]')?.textContent).toContain(
      "This run is finished",
    );
    expect(view.container.querySelector("textarea")).toBeNull();
    const controls = view.container.querySelectorAll("button");
    expect(controls.length).toBe(1);
    expect(controls[0]?.textContent).toBe("Add follow-up step");
    await view.cleanup();
  });

  it("resumes a stopped run from the chat, saying how, with its next-turn settings", async () => {
    const detail = {
      ...runDetailFixture("failed"),
      resume: { mode: "native" as const, step_run_ids: ["step-1"] },
    };
    const view = await mount(<RunClosureBar detail={detail} stepRunId="step-1" />);
    expect(view.container.textContent).toContain("resume it to continue");
    expect(view.container.textContent).toContain("Reattaches the agent's own session");
    expect(findButton("Next turn")).toBeDefined();

    await click("Resume run");
    expect(resume).toHaveBeenCalledTimes(1);
    await view.cleanup();
  });

  it("keeps Resume run off and gives the reason when the run cannot resume", async () => {
    const detail = {
      ...runDetailFixture("canceled"),
      resume: { mode: "unavailable" as const, reason: "The worktree was removed." },
    };
    const view = await mount(<RunClosureBar detail={detail} stepRunId="step-1" />);
    expect(view.container.textContent).toContain("The worktree was removed.");
    expect(findButton("Resume run")?.disabled).toBe(true);
    expect(findButton("Next turn")).toBeUndefined();
    await view.cleanup();
  });

  it("offers no next-turn settings when Resume run reopens another step", async () => {
    const detail = {
      ...runDetailFixture("failed"),
      resume: { mode: "recovery" as const, reason: "No session", step_run_ids: ["step-2"] },
    };
    const view = await mount(<RunClosureBar detail={detail} stepRunId="step-1" />);
    expect(findButton("Resume run")?.disabled).toBe(false);
    expect(findButton("Next turn")).toBeUndefined();
    await view.cleanup();
  });

  it("offers no next-turn settings when Resume run starts another step", async () => {
    const detail = {
      ...runDetailFixture("failed"),
      resume: { mode: "next_step" as const, step_name: "Review" },
    };
    const view = await mount(<RunClosureBar detail={detail} stepRunId="step-1" />);
    expect(findButton("Resume run")?.disabled).toBe(false);
    expect(findButton("Next turn")).toBeUndefined();
    await view.cleanup();
  });
});
