import { createRootRoute, Outlet } from "@tanstack/react-router";
import { PreviewStatusBar } from "@web/components/preview/status-bar";
import { RemoteSessionProvider } from "@web/components/shell/remote-session/provider";
import { useLinearAutoSync } from "@web/components/shell/use-linear-auto-sync";

/** Mounted for every route, so the Linear refresh triggers outlive navigation. */
function RootLayout() {
  useLinearAutoSync();
  return (
    <RemoteSessionProvider>
      <Outlet />
      <PreviewStatusBar />
    </RemoteSessionProvider>
  );
}

export const Route = createRootRoute({ component: RootLayout });
