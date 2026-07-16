import { Outlet, useMatchRoute } from "@tanstack/react-router";
import { SettingsNav } from "@web/components/settings/settings-nav";
import { RouteShell } from "@web/components/shell/route-shell";

export function SettingsLayout() {
  const matchRoute = useMatchRoute();
  const onRuntimes = !!matchRoute({ to: "/settings/runtimes" });
  return (
    <RouteShell
      active={onRuntimes ? "runtimes" : "settings"}
      titleIcon="settings"
      breadcrumbs={[{ label: "Settings", current: true }]}
    >
      <div className="flex h-full min-h-0">
        <SettingsNav />
        <div className="min-w-0 flex-1 overflow-auto">
          <div className="max-w-190 px-8 py-6.5">
            <Outlet />
          </div>
        </div>
      </div>
    </RouteShell>
  );
}
