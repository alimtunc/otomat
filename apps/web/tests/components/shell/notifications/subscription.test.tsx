// @vitest-environment happy-dom
import { notificationIdentity, type DesktopNotification } from "@otomat/domain";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { shellKeys } from "@web/api/query-keys";
import { useDesktopNotifications } from "@web/components/shell/notifications/use-desktop-notifications";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { fakeDesktopBridge, twoHostSnapshot } from "#support/desktop-bridge";
import { mountWithQuery } from "#support/mount";
import { testQueryClient } from "#support/query";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  delete window.otomat;
});

function NotificationProbe() {
  useDesktopNotifications();
  return <Outlet />;
}

it("restores a native click after renderer creation and acknowledges it after navigation", async () => {
  const notice: DesktopNotification = {
    id: "ready",
    category: "review",
    host_id: "local",
    host_alias: null,
    project_id: "p1",
    target: { kind: "run", run_id: "run-42" },
    step_run_id: null,
    interaction_id: null,
  };
  const bridge = fakeDesktopBridge();
  const acknowledgedPaths: string[] = [];
  bridge.notifications.pending = async () => notice;
  const unsubscribe = vi.fn();
  bridge.notifications.onOpen = () => unsubscribe;
  window.otomat = bridge;
  const root = createRootRoute({ component: NotificationProbe });
  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: root.addChildren([
      createRoute({ getParentRoute: () => root, path: "/", component: () => null }),
      createRoute({
        getParentRoute: () => root,
        path: "/runs/$runId/diff",
        component: () => <div>Diff</div>,
      }),
    ]),
  });
  bridge.notifications.acknowledge = vi.fn(async () => {
    acknowledgedPaths.push(router.state.location.pathname);
  });
  const client = testQueryClient();
  client.setQueryDefaults(shellKeys.executionHost, { staleTime: Infinity });
  client.setQueryData(shellKeys.executionHost, twoHostSnapshot({ active_id: "remote" }));
  const mounted = await mountWithQuery(<RouterProvider router={router} />, client);
  cleanups.push(mounted.cleanup);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  expect(bridge.notifications.acknowledge).toHaveBeenCalledWith(notificationIdentity(notice));
  expect(acknowledgedPaths).toEqual(["/runs/run-42/diff"]);
  expect(client.getQueryData(shellKeys.executionHost)).toMatchObject({ active_id: "local" });
  await cleanups.splice(0)[0]();
  expect(unsubscribe).toHaveBeenCalledOnce();
});
