import type { RunContract } from "@otomat/domain";
import { EmptyState, ErrorState, RunStatusChip, Skeleton } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import type { useRunsForIssue } from "@web/api/runs/queries";
import { QueryList } from "@web/components/shell/query-list";

function IssueRunRow({ run }: { run: RunContract }) {
  return (
    <li>
      <Link
        to="/runs/$runId"
        params={{ runId: run.id }}
        className="flex items-center gap-3 px-4 py-3 hover:bg-hover"
      >
        <RunStatusChip status={run.status} />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-tertiary">
          {run.branch}
        </span>
      </Link>
    </li>
  );
}

export function IssueRunList({ query }: { query: ReturnType<typeof useRunsForIssue> }) {
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
              <IssueRunRow key={run.id} run={run} />
            ))}
          </ul>
        </div>
      )}
    </QueryList>
  );
}
