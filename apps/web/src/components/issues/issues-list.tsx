import type { IssueContract } from "@otomat/domain";
import { EmptyState } from "@otomat/ui";
import type { useIssues } from "@web/api/issues/queries";
import { IssueRow } from "@web/components/issues/issue-row";
import { IssuesBoard } from "@web/components/issues/issues-board";
import { CenteredState } from "@web/components/shell/centered-state";
import { DaemonUnreachableState } from "@web/components/shell/daemon-unreachable-state";
import { ListSkeleton } from "@web/components/shell/list-skeleton";
import { QueryList } from "@web/components/shell/query-list";
import { HEAD_CELL, TABLE } from "@web/lib/table";

function IssuesTable({ issues }: { issues: IssueContract[] }) {
  return (
    <table className={TABLE}>
      <thead>
        <tr>
          <th className={`${HEAD_CELL} w-22.5`}>ID</th>
          <th className={HEAD_CELL}>Title</th>
          <th className={`${HEAD_CELL} w-35`}>Status</th>
          <th className={`${HEAD_CELL} w-22.5`}>Source</th>
          <th className={`${HEAD_CELL} w-27.5`}>Updated</th>
        </tr>
      </thead>
      <tbody>
        {issues.map((issue) => (
          <IssueRow key={issue.id} issue={issue} />
        ))}
      </tbody>
    </table>
  );
}

export function IssuesList({
  query,
  filter,
  board = false,
}: {
  query: ReturnType<typeof useIssues>;
  filter?: (issues: IssueContract[]) => IssueContract[];
  board?: boolean;
}) {
  return (
    <QueryList
      query={query}
      pending={<ListSkeleton rows={4} height={44} />}
      error={
        <DaemonUnreachableState title="Couldn’t load issues" onRetry={() => void query.refetch()} />
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
        const visible = filter ? filter(issues) : issues;
        if (visible.length === 0) {
          return (
            <p className="px-4.5 py-6 text-sm text-text-tertiary">No issues match this filter.</p>
          );
        }
        return board ? <IssuesBoard issues={visible} /> : <IssuesTable issues={visible} />;
      }}
    </QueryList>
  );
}
