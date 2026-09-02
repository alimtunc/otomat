import { Button, CopyButton } from "@otomat/ui";
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
  const detail = useReviewDetail({ kind: "pull_request", id: pullRequestId });
  return (
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
      {url === null ? null : (
        <>
          <CopyButton value={url} label="Copy the GitHub link" copiedLabel="Link copied" />
          <Button
            size="sm"
            variant="ghost"
            render={
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                aria-label="Open this pull request on GitHub"
              />
            }
          >
            Open on GitHub
          </Button>
        </>
      )}
    </>
  );
}
