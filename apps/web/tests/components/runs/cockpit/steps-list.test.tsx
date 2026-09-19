// @vitest-environment happy-dom
import { StepsList } from "@web/components/runs/cockpit/steps/list";
import { afterEach, expect, it, vi } from "vitest";

import { eventStream } from "#support/event-stream";
import { mount } from "#support/mount";
import { chainRunDetail } from "#support/run";

const cancelStep = vi.fn();

vi.mock("@web/api/runs/step-mutations", () => ({
  useCancelRunStep: () => ({ mutate: cancelStep, isPending: false }),
}));

vi.mock("@web/api/runs/run-event-stream", () => ({
  useRunEventStream: () => eventStream(),
}));

afterEach(() => {
  cancelStep.mockReset();
  document.body.replaceChildren();
});

it("reads a withdrawn step as canceled, explains its blocked dependent, and offers Cancel step on queued rows only", async () => {
  const view = await mount(
    <StepsList
      detail={chainRunDetail({ implement: "succeeded", review: "withdrawn" })}
      selectedStepId={null}
      onSelectStep={() => {}}
      hasNewActivity={() => false}
    />,
  );

  const rows = [...view.container.querySelectorAll("button")].filter((button) =>
    button.textContent.includes("Step "),
  );
  expect(rows.map((row) => row.textContent)).toEqual([
    "1Step implementSucceeded",
    "2Step reviewCanceled",
    "3Step polishQueued",
  ]);
  expect(view.container.textContent).toContain("Blocked — Step review will not run.");
  const cancels = [...view.container.querySelectorAll("button")].filter((button) =>
    button.textContent.includes("Cancel step"),
  );
  expect(cancels).toHaveLength(1);
  cancels[0]?.click();
  expect(cancelStep).toHaveBeenCalledWith("polish");
  await view.cleanup();
});
