import type { CommandPaletteGroup } from "@otomat/ui";
import { useNavigate } from "@tanstack/react-router";
import { useIssueSearch } from "@web/api/issues/queries";
import { PaletteIssueNotice } from "@web/components/shell/palette/issue-notice";
import { useSelectedProject } from "@web/components/shell/project-selection/use-selected";
import { useRemoteHostAlias } from "@web/lib/active-host";
import { issueShortId } from "@web/lib/ids";
import { useDeferredValue } from "react";

const ISSUE_RESULT_LIMIT = 8;

export function usePaletteIssueGroup(search: string, open: boolean): CommandPaletteGroup {
  const navigate = useNavigate();
  const selected = useSelectedProject();
  const query = search.trim();
  const deferredQuery = useDeferredValue(query);
  const issues = useIssueSearch(open ? selected.projectId : undefined, deferredQuery);
  const project = (selected.projects.data ?? []).find((entry) => entry.id === selected.projectId);
  const hostAlias = useRemoteHostAlias();
  const hostSuffix = hostAlias === null ? "" : ` · ${hostAlias}`;
  const scope = project === undefined ? undefined : `${project.name}${hostSuffix}`;
  const matches = query === deferredQuery ? (issues.data?.issues ?? []) : [];
  const results = matches.slice(0, ISSUE_RESULT_LIMIT);

  return {
    id: "issues",
    heading: scope === undefined ? "Issues" : `Issues · ${scope}`,
    notice: (
      <PaletteIssueNotice
        scope={scope}
        query={query}
        issues={issues}
        shown={results.length}
        matches={issues.data?.total ?? 0}
      />
    ),
    commands: results.map((issue) => ({
      id: `issue-${issue.id}`,
      label: issue.title,
      refId: issueShortId(issue),
      onSelect: () => void navigate({ to: "/issues/$issueId", params: { issueId: issue.id } }),
    })),
  };
}
