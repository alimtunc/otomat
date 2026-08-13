// @vitest-environment happy-dom
import type { EventEnvelope } from "@otomat/domain";
import { PermissionSection } from "@web/components/issues/workspace/rail/permission-section";
import { expect, it, vi } from "vitest";

import { envelope } from "#support/envelope";
import { mount } from "#support/mount";

let streamEvents: EventEnvelope[] = [];

vi.mock("@web/api/runs/run-event-stream", () => ({
  useRunEventStream: () => ({ events: streamEvents }),
}));

function refusal(mode: string, status: string): EventEnvelope[] {
  return [
    envelope({
      type: "runtime.tool_call",
      payload: {
        phase: "result",
        tool_use_id: "tu1",
        is_error: true,
        result: "Claude requested permissions to use Bash, but you haven't granted it yet.",
      },
    }),
    envelope({
      type: "runtime.permission_request",
      payload: {
        tool: "Bash",
        tool_use_id: "tu1",
        permission_mode: mode,
        permission_mode_status: status,
      },
    }),
    envelope({
      id: "denied",
      type: "runtime.permission_response",
      payload: { tool_use_id: "tu1", decision: "denied", decided_by: "provider" },
    }),
  ];
}

it("stays out of the rail entirely when the provider refused nothing", async () => {
  streamEvents = [];
  const mounted = await mount(<PermissionSection />);

  expect(mounted.container.textContent).toBe("");

  await mounted.cleanup();
});

it("names the refused tool, the mode it ran under, and the provider's own words", async () => {
  streamEvents = refusal("acceptEdits", "supervised");
  const mounted = await mount(<PermissionSection />);

  const text = mounted.container.textContent ?? "";
  expect(text).toContain("Bash");
  expect(text).toContain("acceptEdits");
  expect(text).toContain("requested permissions to use Bash");
  expect(text).toContain("cannot approve one mid-run");

  await mounted.cleanup();
});

it("names a refusal whose request never arrived without diagnosing one", async () => {
  streamEvents = [
    envelope({
      id: "denied",
      type: "runtime.permission_response",
      payload: { tool_use_id: "tu9", decision: "denied" },
    }),
  ];
  const mounted = await mount(<PermissionSection />);

  const text = mounted.container.textContent ?? "";
  expect(text).toContain("an unnamed tool");
  expect(text).not.toContain("Relaunch");

  await mounted.cleanup();
});

it("does not read a refusal under the autonomous mode as autonomy having failed", async () => {
  streamEvents = refusal("auto", "autonomous");
  const mounted = await mount(<PermissionSection />);

  const text = mounted.container.textContent ?? "";
  expect(text).toContain("auto");
  expect(text).toContain("Autonomy was not lost");

  await mounted.cleanup();
});
