import type { IssueContract } from "@otomat/domain";
import { EmptyState, ErrorState, Skeleton } from "@otomat/ui";
import type { useIssues } from "@web/api/issues/queries";
import { IssueRow } from "@web/components/issues/issue-row";
import { IssuesBoard } from "@web/components/issues/issues-board";
import { CenteredState } from "@web/components/shell/centered-state";
import { QueryList } from "@web/components/shell/query-list";

const HEAD_CELL =
  "sticky top-0 h-7.5 border-b border-border-subtle bg-background px-3 text-left text-xs font-medium text-text-tertiary";

function IssuesTable({ issues }: { issues: IssueContract[] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          <th className={HEAD_CELL} style={{ width: 90 }}>
            ID
          </th>
          <th className={HEAD_CELL}>Title</th>
          <th className={HEAD_CELL} style={{ width: 140 }}>
            Status
          </th>
          <th className={HEAD_CELL} style={{ width: 90 }}>
            Source
          </th>
          <th className={HEAD_CELL} style={{ width: 110 }}>
            Updated
          </th>
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
      pending={
        <div className="flex flex-col gap-2 p-6">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} height={44} />
          ))}
        </div>
      }
      error={
        <CenteredState>
          <ErrorState
            title="Couldn’t load issues"
            description="The daemon is unreachable. Check that it is running, then retry."
            onRetry={() => void query.refetch()}
          />
        </CenteredState>
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
