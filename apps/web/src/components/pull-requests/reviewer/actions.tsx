import { CopyButton, Icon, IconButton } from "@otomat/ui";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { usePullRequestReviewContext } from "@web/api/prs/queries";
import { useReviewDetail } from "@web/api/reviews/queries";
import { SubmitReviewButton } from "@web/components/runs/review/submit/button";
import { SubmitReviewDialog } from "@web/components/runs/review/submit/dialog";

export interface PullRequestReviewerActionsProps {
  pullRequestId: string;
  url: string | null;
}

export function PullRequestReviewerActions({
  pullRequestId,
  url,
}: PullRequestReviewerActionsProps) {
  const githubLabel = "Open this pull request on GitHub";
  const matchRoute = useMatchRoute();
  const context = usePullRequestReviewContext(pullRequestId);
  const inDiff = Boolean(
    matchRoute({ to: "/pull-requests/$pullRequestId/diff", params: { pullRequestId } }),
  );
  const reviewInToolbar =
    inDiff && context.data !== undefined && context.data.pull_request.head_sha !== null;
  const detail = useReviewDetail({ kind: "pull_request", id: pullRequestId });
  const runId =
    context.data?.issue?.evidence === "attachment" ? context.data.pull_request.run_id : null;
  return (
    <>
      {runId ? (
        <IconButton
          label="Open cockpit"
          icon={<Icon name="monitor" aria-hidden />}
          nativeButton={false}
          role="link"
          render={<Link to="/runs/$runId" params={{ runId }} />}
        />
      ) : null}
      {inDiff && !reviewInToolbar ? (
        <>
          {detail.data === undefined ? (
            <SubmitReviewButton
              disabled
              title={
                detail.isError
                  ? "Otomat could not read this review from the daemon."
                  : "Reading this review…"
              }
            />
          ) : (
            <SubmitReviewDialog
              target={{ kind: "pull_request", id: pullRequestId }}
              detail={detail.data}
            />
          )}
        </>
      ) : null}
      {url === null ? null : (
        <>
          <CopyButton
            value={url}
            label="Copy pull request URL"
            copiedLabel="Pull request URL copied"
          />
          <IconButton
            label={githubLabel}
            icon={<Icon name="external-link" aria-hidden />}
            nativeButton={false}
            role="link"
            render={<a href={url} target="_blank" rel="noreferrer" aria-label={githubLabel} />}
          />
        </>
      )}
    </>
  );
}
