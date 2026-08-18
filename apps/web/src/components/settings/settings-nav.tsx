import { cn, FOCUS_RING, Icon, type IconName } from "@otomat/ui";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { desktopBridge } from "@web/lib/desktop-bridge";

interface SettingsSection {
  to: string;
  label: string;
  icon: IconName;
}

interface SettingsGroup {
  label: string;
  sections: SettingsSection[];
}

const GROUPS: SettingsGroup[] = [
  {
    label: "Project",
    sections: [{ to: "/settings/project", label: "This project", icon: "folder-git-2" }],
  },
  {
    label: "Global",
    sections: [
      { to: "/settings/repositories", label: "Repositories", icon: "folder" },
      { to: "/settings/workspaces", label: "Workspaces", icon: "layers" },
      { to: "/settings/host", label: "Execution hosts", icon: "monitor" },
      { to: "/settings/integrations", label: "Integrations", icon: "plug" },
      { to: "/settings/runtimes", label: "Runtimes", icon: "cpu" },
      { to: "/settings/execution", label: "Execution defaults", icon: "sliders-horizontal" },
      { to: "/settings/workflow-presets", label: "Workflow presets", icon: "workflow" },
      { to: "/settings/agents", label: "Agents", icon: "bot" },
      { to: "/settings/appearance", label: "Appearance", icon: "palette" },
      { to: "/settings/about", label: "About · Daemon", icon: "activity" },
    ],
  },
];

const SANDBOX_SECTION: SettingsSection = {
  to: "/settings/sandbox",
  label: "Sandbox",
  icon: "wand-2",
};

/** The sandbox entry exists only in packaged preview builds; everyone else keeps the static nav. */
function navGroups(): SettingsGroup[] {
  if (desktopBridge()?.preview !== true) return GROUPS;
  return GROUPS.map((group) =>
    group.label === "Global" ? { ...group, sections: [...group.sections, SANDBOX_SECTION] } : group,
  );
}

export function SettingsNav() {
  const matchRoute = useMatchRoute();
  return (
    <nav
      aria-label="Settings sections"
      className="w-52 flex-none overflow-auto border-r border-border-subtle bg-sidebar px-2 py-4"
    >
      {navGroups().map((group) => (
        <div key={group.label} className="pb-3">
          <div className="px-2.5 pb-1 pt-1 text-micro font-semibold tracking-[0.03em] text-text-tertiary">
            {group.label}
          </div>
          <div className="flex flex-col gap-px">
            {group.sections.map((section) => {
              const active = !!matchRoute({ to: section.to });
              return (
                <Link
                  key={section.to}
                  to={section.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex h-7.25 items-center gap-2.25 rounded-md px-2 text-sm font-[450] text-text-secondary",
                    "hover:bg-hover hover:text-foreground",
                    `${FOCUS_RING} focus-visible:outline-offset-[-2px]`,
                    active && "bg-selected text-foreground",
                  )}
                >
                  <Icon
                    name={section.icon}
                    aria-hidden
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active
                        ? "text-iris-text"
                        : "text-text-tertiary group-hover:text-text-secondary",
                    )}
                  />
                  {section.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
