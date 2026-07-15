import { cn, Icon, type IconName } from "@otomat/ui";
import { Link, useMatchRoute } from "@tanstack/react-router";

interface SettingsSection {
  to: string;
  label: string;
  icon: IconName;
}

const SECTIONS: SettingsSection[] = [
  { to: "/settings/repositories", label: "Repositories", icon: "folder" },
  { to: "/settings/runtimes", label: "Runtimes", icon: "cpu" },
  { to: "/settings/agents", label: "Agents", icon: "bot" },
  { to: "/settings/appearance", label: "Appearance", icon: "palette" },
  { to: "/settings/about", label: "About · Daemon", icon: "activity" },
];

export function SettingsNav() {
  const matchRoute = useMatchRoute();
  return (
    <nav
      aria-label="Settings sections"
      className="w-52 flex-none overflow-auto border-r border-border-subtle bg-sidebar px-2 py-4"
    >
      <div className="px-2.5 pb-1 pt-1 text-micro font-semibold tracking-[0.03em] text-text-tertiary">
        Workspace
      </div>
      <div className="flex flex-col gap-px">
        {SECTIONS.map((section) => {
          const active = !!matchRoute({ to: section.to });
          return (
            <Link
              key={section.to}
              to={section.to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex h-7.25 items-center gap-2.25 rounded-md px-2 text-sm font-[450] text-text-secondary",
                "hover:bg-hover hover:text-foreground",
                "focus-visible:[outline:2px_solid_var(--iris-ring)] focus-visible:outline-offset-[-2px]",
                active && "bg-selected text-foreground",
              )}
            >
              <Icon
                name={section.icon}
                aria-hidden
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-iris-text" : "text-text-tertiary group-hover:text-text-secondary",
                )}
              />
              {section.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
