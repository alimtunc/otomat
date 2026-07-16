import type { RunContract } from "@otomat/domain";
import { EmptyState, ErrorState, RunStatusChip, Skeleton } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { useRuns } from "@web/api/runs/queries";
import { CenteredState } from "@web/components/shell/centered-state";
import { QueryList } from "@web/components/shell/query-list";
import { RouteShell } from "@web/components/shell/route-shell";

const HEAD_CELL =
  "sticky top-0 h-7.5 border-b border-border-subtle bg-background px-3 text-left text-xs font-medium text-text-tertiary";
const CELL = "h-10 border-b border-border-subtle px-3";

function RunListRow({ run }: { run: RunContract }) {
  return (
    <tr className="transition-colors hover:bg-hover">
      <td className={`${CELL} relative p-0 font-mono text-text-tertiary`}>
        <Link
          to="/runs/$runId"
          params={{ runId: run.id }}
          className="flex h-full items-center px-3 after:absolute after:inset-0 focus-visible:[outline:2px_solid_var(--iris-ring)] focus-visible:outline-offset-[-2px]"
        >
          {run.id.slice(0, 8)}
        </Link>
      </td>
      <td className={CELL}>
        <RunStatusChip status={run.status} />
      </td>
      <td className={`${CELL} font-mono text-xs text-text-secondary`}>{run.branch}</td>
      <td className={`${CELL} font-mono text-xs text-text-tertiary`}>
        <Link
          to="/issues/$issueId"
          params={{ issueId: run.issue_id }}
          className="hover:text-foreground focus-visible:[outline:2px_solid_var(--iris-ring)] focus-visible:rounded-sm"
        >
          {run.issue_id.slice(0, 8)}
        </Link>
      </td>
    </tr>
  );
}

export function RunsView() {
  const runs = useRuns();
  return (
    <RouteShell active="runs" titleIcon="activity" breadcrumbs={[{ label: "Runs", current: true }]}>
      <QueryList
        query={runs}
        pending={
          <div className="flex flex-col gap-2 p-6">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} height={40} />
            ))}
          </div>
        }
        error={
          <CenteredState>
            <ErrorState
              title="Couldn’t load runs"
              description="The daemon is unreachable. Check that it is running, then retry."
              onRetry={() => void runs.refetch()}
            />
          </CenteredState>
        }
        empty={
          <CenteredState>
            <EmptyState
              icon="activity"
              title="No runs yet"
              description="Launch a run from an issue to see it stream here."
            />
          </CenteredState>
        }
      >
        {(items) => (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={HEAD_CELL} style={{ width: 110 }}>
                  Run
                </th>
                <th className={HEAD_CELL} style={{ width: 160 }}>
                  Status
                </th>
                <th className={HEAD_CELL}>Branch</th>
                <th className={HEAD_CELL} style={{ width: 110 }}>
                  Issue
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((run) => (
                <RunListRow key={run.id} run={run} />
              ))}
            </tbody>
          </table>
        )}
      </QueryList>
    </RouteShell>
  );
}
