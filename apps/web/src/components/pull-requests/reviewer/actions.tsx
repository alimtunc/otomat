import { CopyButton, ExternalLinkIconButton, Icon } from "@otomat/ui";
import { useMatchRoute } from "@tanstack/react-router";
import { usePullRequestReviewContext } from "@web/api/prs/queries";
import { SubmitPullRequestReview } from "@web/components/pull-requests/submit-review";
import { IconLink } from "@web/components/shell/icon-link";

export interface PullRequestReviewerActionsProps {
  pullRequestId: string;
  url: string | null;
}

export function PullRequestReviewerActions({
  pullRequestId,
  url,
}: PullRequestReviewerActionsProps) {
  const matchRoute = useMatchRoute();
  const context = usePullRequestReviewContext(pullRequestId);
  const inDiff = Boolean(
    matchRoute({ to: "/pull-requests/$pullRequestId/diff", params: { pullRequestId } }),
  );
  const reviewInToolbar =
    inDiff && context.data !== undefined && context.data.pull_request.head_sha !== null;
  const runId =
    context.data?.issue?.evidence === "attachment" ? context.data.pull_request.run_id : null;
  return (
    <>
      {runId ? (
        <IconLink
          label="Open cockpit"
          icon={<Icon name="monitor" aria-hidden />}
          to="/runs/$runId"
          params={{ runId }}
        />
      ) : null}
      {inDiff && !reviewInToolbar ? (
        <SubmitPullRequestReview pullRequestId={pullRequestId} />
      ) : null}
      {url === null ? null : (
        <>
          <CopyButton
            value={url}
            label="Copy pull request URL"
            copiedLabel="Pull request URL copied"
          />
          <ExternalLinkIconButton href={url} label="Open this pull request on GitHub" />
        </>
      )}
    </>
  );
}
