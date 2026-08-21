import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useActivityStream } from "@web/api/activity/use-activity-stream";
import { PreviewStatusBar } from "@web/components/preview/status-bar";
import { useActivityNotices } from "@web/components/shell/activity/use-notices";
import { RemoteSessionProvider } from "@web/components/shell/remote-session/provider";
import { useLinearAutoSync } from "@web/components/shell/use-linear-auto-sync";

/** Mounted for every route, so the Linear refresh triggers and the activity stream outlive navigation. */
function RootLayout() {
  useLinearAutoSync();
  useActivityStream();
  useActivityNotices();
  return (
    <RemoteSessionProvider>
      <Outlet />
      <PreviewStatusBar />
    </RemoteSessionProvider>
  );
}

export const Route = createRootRoute({ component: RootLayout });
