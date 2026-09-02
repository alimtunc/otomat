import { Button, CopyButton, Icon } from "@otomat/ui";
import { useReviewDetail } from "@web/api/reviews/queries";
import { SubmitReviewDialog } from "@web/components/runs/review/submit/dialog";

export interface PullRequestReviewerActionsProps {
  pullRequestId: string;
  /** Null while the mirror has no permanent link yet; the GitHub actions then have nothing to point at. */
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
        <Button
          size="sm"
          variant="primary"
          disabled
          title={
            detail.isError
              ? "Otomat could not read this review from the daemon."
              : "Reading this review…"
          }
        >
          <Icon name="git-pull-request" aria-hidden />
          Submit review
        </Button>
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
