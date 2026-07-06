import { ErrorState, Skeleton } from "@otomat/ui";
import { useParams } from "@tanstack/react-router";
import { usePreparePullRequest } from "@web/api/reviews/mutations";
import { useRunPullRequest } from "@web/api/reviews/queries";
import { useRunDetail } from "@web/api/runs/queries";
import { PullRequestForm } from "@web/components/runs/pr/form";
import { CenteredState } from "@web/components/shell/centered-state";

export function RunPrView() {
  const { runId } = useParams({ from: "/runs/$runId/pr" });
  const runQuery = useRunDetail(runId);
  const prQuery = useRunPullRequest(runId);
  const prepare = usePreparePullRequest(runId);

  if (prQuery.isPending) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full max-w-2xl" />
      </div>
    );
  }
  if (prQuery.isError) {
    return (
      <CenteredState>
        <ErrorState
          title="Could not load the pull request draft"
          description="The daemon did not answer. Check that it is running."
          onRetry={() => void prQuery.refetch()}
        />
      </CenteredState>
    );
  }

  const pullRequest = prQuery.data.pull_request;

  return (
    <div className="p-4">
      <PullRequestForm
        key={pullRequest?.id ?? "new"}
        pullRequest={pullRequest}
        branch={runQuery.data?.run.branch ?? null}
        onSubmit={async (value) => {
          await prepare.mutateAsync(value);
        }}
        isPending={prepare.isPending}
      />
    </div>
  );
}
