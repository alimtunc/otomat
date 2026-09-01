// @vitest-environment happy-dom
import { RunClosureBar } from "@web/components/runs/conversation/closure-bar";
import { runDetailFixture } from "@web/gallery/gallery.fixtures";
import { describe, expect, it, vi } from "vitest";

import { mount } from "#support/mount";

vi.mock("@web/components/runs/actions/add-step-dialog", () => ({
  AddStepDialog: () => <button type="button">Add follow-up step</button>,
}));

describe("RunClosureBar", () => {
  it("closes a finished run with the follow-up step as the only control", async () => {
    const view = await mount(<RunClosureBar detail={runDetailFixture("completed")} />);
    expect(view.container.querySelector('[role="status"]')?.textContent).toContain(
      "This run is finished",
    );
    expect(view.container.querySelector("textarea")).toBeNull();
    const controls = view.container.querySelectorAll("button");
    expect(controls.length).toBe(1);
    expect(controls[0]?.textContent).toBe("Add follow-up step");
    await view.cleanup();
  });

  it("tells a stopped run it can resume", async () => {
    const view = await mount(<RunClosureBar detail={runDetailFixture("failed")} />);
    expect(view.container.textContent).toContain("resume it to continue");
    await view.cleanup();
  });
});
