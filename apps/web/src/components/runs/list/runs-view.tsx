import type { RunContract } from "@otomat/domain";
import { cn, EmptyState, RunStatusChip } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { useRuns } from "@web/api/runs/queries";
import { CenteredState } from "@web/components/shell/centered-state";
import { DaemonUnreachableState } from "@web/components/shell/daemon-unreachable-state";
import { ListSkeleton } from "@web/components/shell/list-skeleton";
import { QueryList } from "@web/components/shell/query-list";
import { RouteShell } from "@web/components/shell/route-shell";
import { FOCUS_RING } from "@web/lib/focus";
import { shortId } from "@web/lib/ids";
import { CELL, HEAD_CELL, TABLE } from "@web/lib/table";

function RunListRow({ run }: { run: RunContract }) {
  return (
    <tr className="relative transition-colors hover:bg-hover">
      <td className={cn(CELL, "p-0 font-mono text-text-tertiary")}>
        <Link
          to="/runs/$runId"
          params={{ runId: run.id }}
          className={`flex h-full items-center px-3 after:absolute after:inset-0 ${FOCUS_RING} focus-visible:outline-offset-[-2px]`}
        >
          {shortId(run.id)}
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
          className={`relative z-[1] hover:text-foreground ${FOCUS_RING} focus-visible:rounded-sm`}
        >
          {shortId(run.issue_id)}
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
        pending={<ListSkeleton rows={3} height={40} />}
        error={
          <DaemonUnreachableState title="Couldn’t load runs" onRetry={() => void runs.refetch()} />
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
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={`${HEAD_CELL} w-27.5`}>Run</th>
                <th className={`${HEAD_CELL} w-40`}>Status</th>
                <th className={HEAD_CELL}>Branch</th>
                <th className={`${HEAD_CELL} w-27.5`}>Issue</th>
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
