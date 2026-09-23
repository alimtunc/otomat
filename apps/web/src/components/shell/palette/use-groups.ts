import { useTheme, type CommandPaletteCommand, type CommandPaletteGroup } from "@otomat/ui";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import {
  CONVERSATIONS_NAV,
  INBOX_NAV,
  SETTINGS_NAV,
  WORKSPACE_NAV,
} from "@web/components/shell/nav-items";
import { readPaletteVisits } from "@web/components/shell/palette/history";
import { usePaletteIssueGroup } from "@web/components/shell/palette/use-issue-group";

const NAVIGATE = [INBOX_NAV, CONVERSATIONS_NAV, ...WORKSPACE_NAV, SETTINGS_NAV];

function matching(commands: CommandPaletteCommand[], search: string): CommandPaletteCommand[] {
  const needle = search.trim().toLowerCase();
  return commands.filter((command) =>
    `${command.label} ${command.keywords ?? ""}`.toLowerCase().includes(needle),
  );
}

export interface UsePaletteGroupsOptions {
  search: string;
  open: boolean;
  scope?: string;
  onNewIssue: () => void;
}

export function usePaletteGroups({
  search,
  open,
  onNewIssue,
  scope,
}: UsePaletteGroupsOptions): CommandPaletteGroup[] {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const issuesGroup = usePaletteIssueGroup(search, open);
  const { runId } = useParams({ strict: false });
  const { step } = useSearch({ strict: false });
  const contextCommands: CommandPaletteCommand[] =
    runId === undefined
      ? []
      : [
          {
            id: "context-conversation",
            label: "Follow selected step",
            icon: "message-square",
            onSelect: () =>
              void navigate({ to: "/runs/$runId", params: { runId }, search: { step } }),
          },
          {
            id: "context-diff",
            label: "Open this run’s diff",
            icon: "git-compare",
            onSelect: () =>
              void navigate({ to: "/runs/$runId/diff", params: { runId }, search: { step } }),
          },
        ];
  const recent: CommandPaletteGroup = {
    id: "recent",
    heading: "Recent",
    commands: matching(
      scope === undefined
        ? []
        : readPaletteVisits(scope).map((visit) => ({
            id: `recent-${visit.href}`,
            label: visit.label,
            onSelect: () => void navigate({ to: visit.href }),
          })),
      search,
    ),
  };

  const commands: CommandPaletteGroup = {
    id: "commands",
    heading: "Commands",
    commands: matching(
      [
        ...contextCommands,
        {
          id: "cmd-new-issue",
          label: "New issue",
          icon: "plus",
          shortcut: "C",
          onSelect: onNewIssue,
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

  const appearance: CommandPaletteGroup = {
    id: "appearance",
    heading: "Appearance",
    commands: matching(
      [
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
  return [recent, commands, navigateGroup, issuesGroup, appearance].filter(
    (group) => group.commands.length > 0 || group.notice !== undefined,
  );
}
