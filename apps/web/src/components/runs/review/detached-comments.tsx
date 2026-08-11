import type { ReviewCommentContract } from "@otomat/domain";
import { commentFallbackReason } from "@web/components/runs/review/comment/anchor";
import { ReviewCommentCard } from "@web/components/runs/review/comment/card";
import type { ReviewSelection } from "@web/components/runs/review/use-selection";

export interface DetachedCommentsProps {
  comments: ReviewCommentContract[];
  selection: ReviewSelection;
}

export function DetachedComments({ comments, selection }: DetachedCommentsProps) {
  if (comments.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
        Comments off the current diff
      </h2>
      {comments.map((comment) => (
        <ReviewCommentCard
          key={comment.id}
          comment={comment}
          fallbackReason={commentFallbackReason(comment)}
          selected={selection.selectedIds.has(comment.id)}
          onSelectedChange={(selected) => selection.toggle(comment.id, selected)}
        />
      ))}
    </section>
  );
}
