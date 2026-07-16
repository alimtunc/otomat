import { Icon, useTheme, type CommandPaletteGroup, type IconName } from "@otomat/ui";
import { useNavigate } from "@tanstack/react-router";
import { useIssues } from "@web/api/issues/queries";

function glyph(name: IconName) {
  return function Glyph({ className }: { className?: string }) {
    return <Icon name={name} aria-hidden className={className} />;
  };
}

const NAVIGATE: { id: string; label: string; icon: IconName; to: string }[] = [
  { id: "nav-issues", label: "Issues", icon: "list-todo", to: "/issues" },
  { id: "nav-runs", label: "Runs", icon: "activity", to: "/runs" },
  { id: "nav-reviews", label: "Reviews", icon: "git-pull-request", to: "/reviews" },
  { id: "nav-agents", label: "Agents", icon: "bot", to: "/agents" },
  { id: "nav-usage", label: "Usage", icon: "bar-chart", to: "/usage" },
  { id: "nav-runtimes", label: "Runtimes", icon: "cpu", to: "/settings/runtimes" },
  { id: "nav-skills", label: "Skills", icon: "book", to: "/skills" },
  { id: "nav-settings", label: "Settings", icon: "settings", to: "/settings/repositories" },
  { id: "nav-inbox", label: "Inbox", icon: "inbox", to: "/inbox" },
];

export function usePaletteGroups({ onNewIssue }: { onNewIssue?: () => void }) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const issues = useIssues();

  const commands: CommandPaletteGroup = {
    id: "commands",
    heading: "Commands",
    commands: [
      ...(onNewIssue
        ? [
            {
              id: "cmd-new-issue",
              label: "New issue",
              icon: glyph("plus"),
              shortcut: "C",
              onSelect: onNewIssue,
            },
          ]
        : []),
      {
        id: "cmd-toggle-theme",
        label: "Toggle theme",
        icon: glyph(theme === "dark" ? "sun" : "moon"),
        keywords: "dark light appearance",
        onSelect: () => setTheme(theme === "dark" ? "light" : "dark"),
      },
    ],
  };

  const navigateGroup: CommandPaletteGroup = {
    id: "navigate",
    heading: "Navigate",
    commands: NAVIGATE.map((entry) => ({
      id: entry.id,
      label: entry.label,
      icon: glyph(entry.icon),
      onSelect: () => void navigate({ to: entry.to }),
    })),
  };

  const recentIssues: CommandPaletteGroup = {
    id: "recent-issues",
    heading: "Recent issues",
    commands: (issues.data ?? []).slice(0, 5).map((issue) => ({
      id: `issue-${issue.id}`,
      label: issue.title,
      refId: issue.source_external_id ?? issue.id.slice(0, 8),
      keywords: issue.source,
      onSelect: () => void navigate({ to: "/issues/$issueId", params: { issueId: issue.id } }),
    })),
  };

  const groups = [commands, navigateGroup];
  if (recentIssues.commands.length > 0) groups.push(recentIssues);
  return groups;
}
