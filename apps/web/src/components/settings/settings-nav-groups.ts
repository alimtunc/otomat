import type { IconName } from "@otomat/ui";
import { desktopBridge } from "@web/lib/desktop-bridge";

export type SettingsNavEntry = { label: string; icon: IconName } &
  /** `exact` stops a parent entry claiming its own child routes. */
  ({ to: string; exact?: true } | { href: string });

export interface SettingsNavGroup {
  label: string;
  entries: SettingsNavEntry[];
}

const PROJECT: SettingsNavGroup = {
  label: "Project",
  entries: [
    { to: "/settings/project", label: "This project", icon: "folder-git-2", exact: true },
    { to: "/settings/project/workspaces", label: "Workspaces", icon: "layers" },
    { to: "/settings/project/agents", label: "Agents", icon: "bot" },
    { to: "/settings/project/skills", label: "Skills", icon: "book" },
  ],
};

/** Read from and written to the daemon currently answering, and to no other. */
const HOST_ENTRIES = [
  { to: "/settings/agents", label: "Agents", icon: "bot" },
  { to: "/settings/skills", label: "Skills", icon: "book" },
  { to: "/settings/execution", label: "Execution defaults", icon: "sliders-horizontal" },
  { to: "/settings/workflow-presets", label: "Workflow presets", icon: "workflow" },
] satisfies SettingsNavEntry[];

const EVERY_HOST_ENTRIES: SettingsNavEntry[] = [
  { to: "/settings/repositories", label: "Repositories", icon: "folder" },
  { to: "/settings/host", label: "Execution hosts", icon: "monitor" },
  { to: "/settings/integrations", label: "Integrations", icon: "plug" },
  { to: "/settings/appearance", label: "Appearance", icon: "palette" },
];

/** The desktop shell's own test data: a reset refuses while a remote host is active. */
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

export function hostOwnedSettingsRoutes(): string[] {
  return HOST_ENTRIES.map((entry) => entry.to);
}

export function settingsNavGroups(hostLabel: string): SettingsNavGroup[] {
  const everyHost =
    desktopBridge()?.preview === true ? [...EVERY_HOST_ENTRIES, SANDBOX_ENTRY] : EVERY_HOST_ENTRIES;
  return [
    PROJECT,
    { label: `Global · ${hostLabel}`, entries: HOST_ENTRIES },
    { label: "All hosts", entries: everyHost },
    REFERENCE,
  ];
}
