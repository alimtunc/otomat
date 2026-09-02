import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useActivityStream } from "@web/api/activity/use-activity-stream";
import { PreviewStatusBar } from "@web/components/preview/status-bar";
import { useActivityNotices } from "@web/components/shell/activity/use-notices";
import { useOpenHostInboxes } from "@web/components/shell/project-tabs/use-open-host-inboxes";
import { RemoteSessionProvider } from "@web/components/shell/remote-session/provider";
import { useLinearAutoSync } from "@web/components/shell/use-linear-auto-sync";

/** Mounted for every route, so these subscriptions outlive navigation. */
function RootLayout() {
  useLinearAutoSync();
  useActivityStream();
  useActivityNotices();
  useOpenHostInboxes();
  return (
    <RemoteSessionProvider>
      <Outlet />
      <PreviewStatusBar />
    </RemoteSessionProvider>
  );
}

export const Route = createRootRoute({ component: RootLayout });
