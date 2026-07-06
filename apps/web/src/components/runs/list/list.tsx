import { EmptyState, ErrorState, Skeleton } from "@otomat/ui";
import type { useRunsForIssue } from "@web/api/runs/queries";
import { RunRow } from "@web/components/runs/list/row";
import { QueryList } from "@web/components/shell/query-list";

export function RunsList({ query }: { query: ReturnType<typeof useRunsForIssue> }) {
  return (
    <QueryList
      query={query}
      pending={<Skeleton height={44} />}
      error={
        <ErrorState
          variant="inline"
          title="Couldn’t load runs"
          onRetry={() => void query.refetch()}
        />
      }
      empty={
        <div className="rounded-lg border border-border-subtle bg-card">
          <EmptyState
            icon="inbox"
            variant="inline"
            title="No runs yet"
            description="Start a run to launch the agent on this issue."
          />
        </div>
      }
    >
      {(runs) => (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-text-secondary">Runs</h2>
          <ul className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border-subtle">
            {runs.map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </ul>
        </div>
      )}
    </QueryList>
  );
}
