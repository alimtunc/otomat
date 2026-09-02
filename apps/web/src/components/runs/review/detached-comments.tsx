import type { ReviewCommentContract, ReviewTarget } from "@otomat/domain";
import { commentFallbackReason } from "@web/components/runs/review/comment/anchor";
import { ReviewCommentCard } from "@web/components/runs/review/comment/card";

export interface DetachedCommentsProps {
  target: ReviewTarget;
  comments: ReviewCommentContract[];
}

export function DetachedComments({ target, comments }: DetachedCommentsProps) {
  if (comments.length === 0) return null;
  return (
    <section className="flex flex-col gap-2 p-4">
      <h2 className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
        Comments off the current diff
      </h2>
      {comments.map((comment) => (
        <ReviewCommentCard
          key={comment.id}
          target={target}
          comment={comment}
          fallbackReason={commentFallbackReason(comment)}
        />
      ))}
    </section>
  );
}
