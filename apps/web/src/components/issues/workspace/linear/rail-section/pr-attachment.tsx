import type { RunContract } from "@otomat/domain";
import { Button } from "@otomat/ui";
import { usePublishLinearPrLink } from "@web/api/linear/writeback";
import { useRunPullRequest } from "@web/api/prs/queries";

export function PrAttachment({ issueId, run }: { issueId: string; run: RunContract }) {
  const pr = useRunPullRequest(run.id);
  const publish = usePublishLinearPrLink(issueId);
  if (pr.isError) {
    return (
      <div className="flex items-center gap-2 text-xs text-text-tertiary">
        <span className="flex-1">The run's pull request could not be loaded.</span>
        <Button size="xs" variant="outline" onClick={() => void pr.refetch()}>
          Retry
        </Button>
      </div>
    );
  }
  const pullRequest = pr.data?.pull_request ?? null;
  if (pullRequest === null || pullRequest.url === null) return null;
  const url = pullRequest.url;
  const title = pullRequest.number === null ? "Pull request" : `PR #${pullRequest.number}`;
  return (
    <Button
      size="xs"
      variant="outline"
      className="w-full"
      loading={publish.isPending}
      onClick={() => publish.mutate({ url, title, run_id: run.id })}
    >
      Attach {title} to Linear
    </Button>
  );
}
