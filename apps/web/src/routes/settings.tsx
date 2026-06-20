import { cn } from "@otomat/ui";
import { Link, Outlet, useMatchRoute } from "@tanstack/react-router";

import { RouteShell } from "./shell";

interface SettingsSection {
  to: string;
  label: string;
}

const SECTIONS: SettingsSection[] = [
  { to: "/settings/repositories", label: "Repositories" },
  { to: "/settings/runtimes", label: "Runtimes" },
  { to: "/settings/agents", label: "Agents" },
  { to: "/settings/appearance", label: "Appearance" },
  { to: "/settings/about", label: "About" },
];

function SettingsNav() {
  const matchRoute = useMatchRoute();
  return (
    <nav
      aria-label="Settings sections"
      className="flex w-50 flex-none flex-col gap-px border-r border-border-subtle p-2"
    >
      {SECTIONS.map((section) => {
        const active = !!matchRoute({ to: section.to });
        return (
          <Link
            key={section.to}
            to={section.to}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-7.25 items-center rounded-md px-2 text-sm font-[450] text-text-secondary",
              "hover:bg-hover hover:text-foreground",
              "focus-visible:outline-none focus-visible:[outline:2px_solid_var(--iris-ring)] focus-visible:outline-offset-[-2px]",
              active && "bg-selected text-foreground",
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SettingsRoute() {
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
