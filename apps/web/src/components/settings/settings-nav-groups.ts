import type { IconName } from "@otomat/ui";
import { desktopBridge } from "@web/lib/desktop-bridge";

/** A settings destination: an in-app route, or a document served outside the router. */
export type SettingsNavEntry = { label: string; icon: IconName } & (
  | { to: string }
  | { href: string }
);

export interface SettingsNavGroup {
  label: string;
  entries: SettingsNavEntry[];
}

const PROJECT: SettingsNavGroup = {
  label: "Project",
  entries: [{ to: "/settings/project", label: "This project", icon: "folder-git-2" }],
};

const GLOBAL_ENTRIES: SettingsNavEntry[] = [
  { to: "/settings/agents", label: "Agents", icon: "bot" },
  { to: "/settings/skills", label: "Skills", icon: "book" },
  { to: "/settings/repositories", label: "Repositories", icon: "folder" },
  { to: "/settings/workspaces", label: "Workspaces", icon: "layers" },
  { to: "/settings/host", label: "Execution hosts", icon: "monitor" },
  { to: "/settings/integrations", label: "Integrations", icon: "plug" },
  { to: "/settings/execution", label: "Execution defaults", icon: "sliders-horizontal" },
  { to: "/settings/workflow-presets", label: "Workflow presets", icon: "workflow" },
  { to: "/settings/appearance", label: "Appearance", icon: "palette" },
];

const SANDBOX_ENTRY: SettingsNavEntry = {
  to: "/settings/sandbox",
  label: "Sandbox",
  icon: "wand-2",
};

const REFERENCE: SettingsNavGroup = {
  label: "Reference",
  entries: [
    { to: "/settings/runtimes", label: "Runtimes", icon: "cpu" },
    { to: "/settings/about", label: "About · Daemon", icon: "activity" },
    { href: "/gallery.html", label: "Design system", icon: "layers" },
  ],
};

/** The sandbox entry exists only in packaged preview builds; everyone else keeps the static nav. */
export function settingsNavGroups(): SettingsNavGroup[] {
  const global =
    desktopBridge()?.preview === true ? [...GLOBAL_ENTRIES, SANDBOX_ENTRY] : GLOBAL_ENTRIES;
  return [PROJECT, { label: "Global", entries: global }, REFERENCE];
}
