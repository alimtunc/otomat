import type { RunContract } from "@otomat/domain";
import { EmptyState, ErrorState, Skeleton } from "@otomat/ui";
import type { useRunsForIssue } from "@web/api/runs/queries";
import { RunConversations } from "@web/components/issues/workspace/run-conversations";
import { QueryList } from "@web/components/shell/query-list";
import type { ReactNode } from "react";

function NoRunsEmptyState({ launchAction }: { launchAction: ReactNode }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-card">
      <EmptyState
        icon="play"
        variant="inline"
        title="No runs yet"
        description="This issue has no agent activity. Launch a run to follow its live ledger here."
        action={launchAction}
      />
    </div>
  );
}

export function RunsArea({
  query,
  launchAction,
  followedRun,
  onFollow,
  selectedStepId,
  onSelectStep,
}: {
  query: ReturnType<typeof useRunsForIssue>;
  launchAction: ReactNode;
  followedRun: RunContract | null;
  onFollow: (runId: string) => void;
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
}) {
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
      empty={<NoRunsEmptyState launchAction={launchAction} />}
    >
      {(runs) => (
        <RunConversations
          runs={runs}
          followedRunId={followedRun?.id ?? null}
          selectedStepId={selectedStepId}
          onFollow={onFollow}
          onSelectStep={onSelectStep}
        />
      )}
    </QueryList>
  );
}
