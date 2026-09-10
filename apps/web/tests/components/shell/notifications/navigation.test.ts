// @vitest-environment happy-dom
import type { DesktopNotification } from "@otomat/domain";
import {
  notificationRoute,
  selectNotificationProject,
} from "@web/components/shell/notifications/navigation";
import { projectSelectionStore } from "@web/components/shell/project-selection/store";
import { activeHost, activeHostStore } from "@web/lib/active-host";
import { afterEach, expect, it, vi } from "vitest";

import { fakeDesktopBridge, twoHostSnapshot } from "#support/desktop-bridge";

const NOTICE: DesktopNotification = {
  id: "one",
  category: "permission",
  project_id: "project",
  host_id: "remote",
  host_alias: "otomat-vps",
  target: { kind: "run", run_id: "run" },
  step_run_id: "step",
  interaction_id: "request",
};

afterEach(() => {
  activeHostStore.actions.activate({ id: "local", daemonUrl: "" });
});

it("targets the request's step and anchor, the run diff and each PR surface", () => {
  expect(notificationRoute(NOTICE)).toEqual({
    to: "/runs/$runId",
    params: { runId: "run" },
    search: { step: "step" },
    hash: "interaction-request",
  });
  expect(notificationRoute({ ...NOTICE, category: "review" })).toEqual({
    to: "/runs/$runId/diff",
    params: { runId: "run" },
  });
  expect(
    notificationRoute({ ...NOTICE, target: { kind: "run_pull_request", run_id: "run" } }),
  ).toEqual({ to: "/runs/$runId/pr", params: { runId: "run" } });
  expect(
    notificationRoute({ ...NOTICE, target: { kind: "pull_request", pull_request_id: "pr" } }),
  ).toEqual({ to: "/pull-requests/$pullRequestId/diff", params: { pullRequestId: "pr" } });
});

it("activates the owning host and project before navigation", async () => {
  const bridge = fakeDesktopBridge();
  bridge.executionHost.snapshot = async () => twoHostSnapshot();
  bridge.executionHost.select = vi.fn(async () => ({
    ok: true as const,
    url: "http://127.0.0.1:6000",
  }));
  await selectNotificationProject(bridge, NOTICE);
  expect(bridge.executionHost.select).toHaveBeenCalledWith("remote");
  expect(activeHost()).toEqual({ id: "remote", daemonUrl: "http://127.0.0.1:6000" });
  expect(projectSelectionStore.state.get("remote")).toBe("project");
});

it("refuses a replaced host or failed host switch without changing selection", async () => {
  const bridge = fakeDesktopBridge();
  bridge.executionHost.select = vi.fn(async () => ({ ok: false as const, message: "Offline" }));
  await expect(selectNotificationProject(bridge, NOTICE)).rejects.toThrow("no longer configured");
  expect(bridge.executionHost.select).not.toHaveBeenCalled();
  bridge.executionHost.snapshot = async () => twoHostSnapshot();
  await expect(selectNotificationProject(bridge, NOTICE)).rejects.toThrow("Offline");
  expect(activeHost().id).toBe("local");
});
