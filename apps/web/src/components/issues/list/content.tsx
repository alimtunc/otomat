import type { IssueContract } from "@otomat/domain";
import { EmptyState } from "@otomat/ui";
import type { UseQueryResult } from "@tanstack/react-query";
import { ErrorReport } from "@web/components/diagnostics/error-report";
import { IssuesBoard } from "@web/components/issues/list/board";
import { IssuesTable } from "@web/components/issues/list/table";
import { CenteredState } from "@web/components/shell/centered-state";
import { ListSkeleton } from "@web/components/shell/list-skeleton";
import { QueryList } from "@web/components/shell/query-list";
import type { IssueGroup } from "@web/lib/issue/grouping";
import type { IssuesLayout } from "@web/lib/issue/view-config";

export interface IssuesContentProps {
  query: UseQueryResult<IssueContract[]>;
  groups: (issues: IssueContract[]) => IssueGroup[];
  layout: IssuesLayout;
  showGroupHeadings: boolean;
  collapsed: string[];
  onToggleGroup: (key: string) => void;
}

export function IssuesContent({
  query,
  groups,
  layout,
  showGroupHeadings,
  collapsed,
  onToggleGroup,
}: IssuesContentProps) {
  return (
    <QueryList
      query={query}
      pending={<ListSkeleton rows={4} height={44} />}
      error={
        <ErrorReport
          error={query.error}
          context="Couldn’t load issues"
          onRetry={() => void query.refetch()}
        />
      }
      empty={
        <CenteredState>
          <EmptyState
            icon="inbox"
            title="No issues yet"
            description="Start a local run to create your first issue and stream its events live."
          />
        </CenteredState>
      }
    >
      {(issues) => {
        const visible = groups(issues);
        if (visible.length === 0) {
          return (
            <p className="px-4.5 py-6 text-sm text-text-tertiary">No issues match this filter.</p>
          );
        }
        const layoutProps = {
          groups: visible,
          showGroupHeadings,
          collapsed,
          onToggleGroup,
        };
        return layout === "board" ? (
          <IssuesBoard {...layoutProps} />
        ) : (
          <IssuesTable {...layoutProps} />
        );
      }}
    </QueryList>
  );
}
