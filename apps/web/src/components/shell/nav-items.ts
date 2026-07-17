import type { IconName } from "@otomat/ui";

export type ShellSection =
  | "issues"
  | "runs"
  | "reviews"
  | "agents"
  | "usage"
  | "runtimes"
  | "skills"
  | "settings"
  | "inbox";

export interface NavItem {
  section: ShellSection;
  icon: IconName;
  label: string;
  to: string;
}

export const WORKSPACE_NAV: NavItem[] = [
  { section: "issues", icon: "list-todo", label: "Issues", to: "/issues" },
  { section: "runs", icon: "activity", label: "Runs", to: "/runs" },
  { section: "reviews", icon: "git-pull-request", label: "Reviews", to: "/reviews" },
  { section: "agents", icon: "bot", label: "Agents", to: "/agents" },
  { section: "usage", icon: "bar-chart", label: "Usage", to: "/usage" },
];

export const CONFIGURE_NAV: NavItem[] = [
  { section: "runtimes", icon: "cpu", label: "Runtimes", to: "/settings/runtimes" },
  { section: "skills", icon: "book", label: "Skills", to: "/skills" },
  { section: "settings", icon: "settings", label: "Settings", to: "/settings/repositories" },
];

export const INBOX_NAV: NavItem = { section: "inbox", icon: "inbox", label: "Inbox", to: "/inbox" };
