import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useLinearAutoSync } from "@web/components/shell/use-linear-auto-sync";

/** Mounted for every route, so the Linear refresh triggers outlive navigation. */
function RootLayout() {
  useLinearAutoSync();
  return <Outlet />;
}

export const Route = createRootRoute({ component: RootLayout });
