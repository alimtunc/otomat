import type { IconName } from "@otomat/ui";

export type ShellSection =
  | "issues"
  | "runs"
  | "reviews"
  | "usage"
  | "settings"
  | "inbox"
  | "conversations"
  | "files";

export interface NavItem {
  section: ShellSection;
  icon: IconName;
  label: string;
  to: string;
}

export const WORKSPACE_NAV: NavItem[] = [
  { section: "issues", icon: "list-todo", label: "Issues", to: "/issues" },
  { section: "files", icon: "folder", label: "Files", to: "/files" },
  { section: "runs", icon: "activity", label: "Runs", to: "/runs" },
  {
    section: "conversations",
    icon: "message-square",
    label: "Conversations",
    to: "/conversations",
  },
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

const SECTION_BY_SEGMENT = new Map<string, ShellSection>([
  ["issues", "issues"],
  ["runs", "runs"],
  ["reviews", "reviews"],
  ["pull-requests", "reviews"],
  ["usage", "usage"],
  ["settings", "settings"],
  ["inbox", "inbox"],
  ["conversations", "conversations"],
  ["files", "files"],
]);

export function sectionForPath(pathname: string): ShellSection | null {
  return SECTION_BY_SEGMENT.get(pathname.split("/")[1] ?? "") ?? null;
}
