import { useTheme, type CommandPaletteCommand, type CommandPaletteGroup } from "@otomat/ui";
import { useNavigate } from "@tanstack/react-router";
import { CONFIGURE_NAV, INBOX_NAV, WORKSPACE_NAV } from "@web/components/shell/nav-items";
import { usePaletteIssueGroup } from "@web/components/shell/palette/use-issue-group";

const NAVIGATE = [...WORKSPACE_NAV, ...CONFIGURE_NAV, INBOX_NAV];

function matching(commands: CommandPaletteCommand[], search: string): CommandPaletteCommand[] {
  const needle = search.trim().toLowerCase();
  return commands.filter((command) =>
    `${command.label} ${command.keywords ?? ""}`.toLowerCase().includes(needle),
  );
}

export interface UsePaletteGroupsOptions {
  search: string;
  onNewIssue: () => void;
}

export function usePaletteGroups({
  search,
  onNewIssue,
}: UsePaletteGroupsOptions): CommandPaletteGroup[] {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const issuesGroup = usePaletteIssueGroup(search);

  const commands: CommandPaletteGroup = {
    id: "commands",
    heading: "Commands",
    commands: matching(
      [
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
      search,
    ),
  };

  const navigateGroup: CommandPaletteGroup = {
    id: "navigate",
    heading: "Navigate",
    commands: matching(
      NAVIGATE.map((entry) => ({
        id: `nav-${entry.section}`,
        label: entry.label,
        icon: entry.icon,
        onSelect: () => void navigate({ to: entry.to }),
      })),
      search,
    ),
  };

  const groups = [commands, navigateGroup].filter((group) => group.commands.length > 0);
  return [...groups, issuesGroup];
}
