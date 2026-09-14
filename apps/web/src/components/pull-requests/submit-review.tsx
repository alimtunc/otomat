import { useReviewDetail } from "@web/api/reviews/queries";
import { SubmitReviewButton } from "@web/components/runs/review/submit/button";
import { SubmitReviewDialog } from "@web/components/runs/review/submit/dialog";

export function SubmitPullRequestReview({ pullRequestId }: { pullRequestId: string }) {
  const target = { kind: "pull_request", id: pullRequestId } as const;
  const detail = useReviewDetail(target);
  if (detail.data === undefined) {
    return (
      <SubmitReviewButton
        disabled
        title={
          detail.isError
            ? "Otomat could not read this review from the daemon."
            : "Reading this review…"
        }
      />
    );
  }
  return <SubmitReviewDialog target={target} detail={detail.data} />;
}
