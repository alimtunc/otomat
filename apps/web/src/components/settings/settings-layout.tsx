import { Outlet } from "@tanstack/react-router";
import { SettingsNav } from "@web/components/settings/settings-nav";
import { RouteShell } from "@web/components/shell/route-shell";

export function SettingsLayout() {
  return (
    <RouteShell active="settings" breadcrumbs={[{ label: "Settings", current: true }]}>
      <div className="flex h-full min-h-0">
        <SettingsNav />
        <div className="min-w-0 flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </div>
    </RouteShell>
  );
}
