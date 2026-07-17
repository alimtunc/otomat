import { useTheme, type CommandPaletteGroup } from "@otomat/ui";
import { useNavigate } from "@tanstack/react-router";
import { useIssues } from "@web/api/issues/queries";
import { CONFIGURE_NAV, INBOX_NAV, WORKSPACE_NAV } from "@web/components/shell/nav-items";
import { issueShortId } from "@web/lib/ids";

const NAVIGATE = [...WORKSPACE_NAV, ...CONFIGURE_NAV, INBOX_NAV];

export function usePaletteGroups({ onNewIssue }: { onNewIssue: () => void }) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const issues = useIssues();

  const commands: CommandPaletteGroup = {
    id: "commands",
    heading: "Commands",
    commands: [
      {
        id: "cmd-new-issue",
        label: "New issue",
        icon: "plus",
        shortcut: "C",
        onSelect: onNewIssue,
      },
      {
        id: "cmd-toggle-theme",
        label: "Toggle theme",
        icon: theme === "dark" ? "sun" : "moon",
        keywords: "dark light appearance",
        onSelect: () => setTheme(theme === "dark" ? "light" : "dark"),
      },
    ],
  };

  const navigateGroup: CommandPaletteGroup = {
    id: "navigate",
    heading: "Navigate",
    commands: NAVIGATE.map((entry) => ({
      id: `nav-${entry.section}`,
      label: entry.label,
      icon: entry.icon,
      onSelect: () => void navigate({ to: entry.to }),
    })),
  };

  const recentIssues: CommandPaletteGroup = {
    id: "recent-issues",
    heading: "Recent issues",
    commands: (issues.data ?? []).slice(0, 5).map((issue) => ({
      id: `issue-${issue.id}`,
      label: issue.title,
      refId: issueShortId(issue),
      keywords: issue.source,
      onSelect: () => void navigate({ to: "/issues/$issueId", params: { issueId: issue.id } }),
    })),
  };

  const groups = [commands, navigateGroup];
  if (recentIssues.commands.length > 0) groups.push(recentIssues);
  return groups;
}
