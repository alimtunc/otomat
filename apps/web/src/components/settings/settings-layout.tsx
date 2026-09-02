import { Outlet, useMatchRoute } from "@tanstack/react-router";
import { HostScopeNote } from "@web/components/settings/host-scope-note";
import { SettingsNav } from "@web/components/settings/settings-nav";
import { hostOwnedSettingsRoutes } from "@web/components/settings/settings-nav-groups";
import { RouteShell } from "@web/components/shell/route-shell";
import { useBackNavigation } from "@web/components/shell/use-back-navigation";

export function SettingsLayout() {
  const back = useBackNavigation(null);
  const matchRoute = useMatchRoute();
  const hostOwned = hostOwnedSettingsRoutes().some((to) => matchRoute({ to, fuzzy: true }));
  return (
    <RouteShell
      active="settings"
      titleIcon="settings"
      back={back}
      breadcrumbs={[{ label: "Settings", current: true }]}
    >
      <div className="flex h-full min-h-0">
        <SettingsNav />
        <div className="min-w-0 flex-1 overflow-auto">
          <div className="max-w-190 px-8 py-6.5">
            {hostOwned ? <HostScopeNote /> : null}
            <Outlet />
          </div>
        </div>
      </div>
    </RouteShell>
  );
}
