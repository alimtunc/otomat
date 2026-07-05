import { EmptyState, ErrorState, Skeleton } from "@otomat/ui";
import type { useRunsForIssue } from "@web/api/runs/queries";
import { RunRow } from "@web/components/runs/launch/row";
import { Inbox } from "lucide-react";

export function RunsList({ query }: { query: ReturnType<typeof useRunsForIssue> }) {
  if (query.isPending) return <Skeleton height={44} />;

  if (query.isError) {
    return (
      <ErrorState
        variant="inline"
        title="Couldn’t load runs"
        onRetry={() => void query.refetch()}
      />
    );
  }

  if (query.data.length === 0) {
    return (
      <div className="rounded-lg border border-border-subtle bg-card">
        <EmptyState
          icon={Inbox}
          variant="inline"
          title="No runs yet"
          description="Start a run to launch the agent on this issue."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-text-secondary">Runs</h2>
      <ul className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border-subtle">
        {query.data.map((run) => (
          <RunRow key={run.id} run={run} />
        ))}
      </ul>
    </div>
  );
}
