import { isPendingReviewComment, type ReviewCommentContract } from "@otomat/domain";
import { StatusChip } from "@otomat/ui";

export function CommentPublication({ comment }: { comment: ReviewCommentContract }) {
  const permalink = isPendingReviewComment(comment) ? null : comment.external_url;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <StatusChip kind="reviewCommentPublication" status={comment.publication_status} />
        {isPendingReviewComment(comment) ? (
          <span className="text-xs text-text-tertiary">
            Included in the next review you submit.
          </span>
        ) : null}
        {permalink === null ? null : (
          <a
            href={permalink}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-iris-text underline underline-offset-2"
          >
            View on GitHub
          </a>
        )}
      </div>
      {comment.publication_error === null ? null : (
        <p role="alert" className="text-xs text-danger">
          {comment.publication_error}
        </p>
      )}
    </div>
  );
}
