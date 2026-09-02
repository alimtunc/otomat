import { cn, FOCUS_RING_INSET, Icon } from "@otomat/ui";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { settingsNavGroups } from "@web/components/settings/settings-nav-groups";
import { useActiveHostLabel } from "@web/lib/active-host";

const ENTRY = cn(
  "group flex h-7.25 items-center gap-2.25 rounded-md px-2 text-sm font-[450] text-text-secondary",
  "hover:bg-hover hover:text-foreground",
  FOCUS_RING_INSET,
);

export function SettingsNav() {
  const matchRoute = useMatchRoute();
  const hostLabel = useActiveHostLabel();
  return (
    <nav
      aria-label="Settings sections"
      className="w-52 flex-none overflow-auto border-r border-border-subtle bg-sidebar px-2 py-4"
    >
      {settingsNavGroups(hostLabel).map((group) => (
        <div key={group.label} className="pb-3">
          <div className="px-2.5 pb-1 pt-1 text-micro font-semibold tracking-[0.03em] text-text-tertiary">
            {group.label}
          </div>
          <div className="flex flex-col gap-px">
            {group.entries.map((entry) => {
              const active =
                "to" in entry && !!matchRoute({ to: entry.to, fuzzy: entry.exact !== true });
              const icon = (
                <Icon
                  name={entry.icon}
                  aria-hidden
                  className={cn(
                    "h-4 w-4 shrink-0",
                    active
                      ? "text-iris-text"
                      : "text-text-tertiary group-hover:text-text-secondary",
                  )}
                />
              );
              return "to" in entry ? (
                <Link
                  key={entry.label}
                  to={entry.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(ENTRY, active && "bg-selected text-foreground")}
                >
                  {icon}
                  {entry.label}
                </Link>
              ) : (
                <a key={entry.label} href={entry.href} className={ENTRY}>
                  {icon}
                  {entry.label}
                </a>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
