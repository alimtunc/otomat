import type { IconName } from "@otomat/ui";

export type ShellSection = "issues" | "runs" | "reviews" | "usage" | "settings" | "inbox";

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
  { section: "usage", icon: "bar-chart", label: "Usage", to: "/usage" },
];

export const INBOX_NAV: NavItem = { section: "inbox", icon: "inbox", label: "Inbox", to: "/inbox" };

export const SETTINGS_NAV: NavItem = {
  section: "settings",
  icon: "settings",
  label: "Settings",
  to: "/settings",
};
