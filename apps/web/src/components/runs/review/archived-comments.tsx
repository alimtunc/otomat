import type { ReviewCommentContract } from "@otomat/domain";
import { ReviewCommentCard } from "@web/components/runs/review/comment-card";
import type { ReviewSelection } from "@web/components/runs/review/use-selection";

export interface ArchivedCommentsProps {
  comments: ReviewCommentContract[];
  selection: ReviewSelection;
}

/** Comments no longer anchored to the live diff — rendered from their snapshot, still selectable for a fix. */
export function ArchivedComments({ comments, selection }: ArchivedCommentsProps) {
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
          showSnapshot
          selected={selection.selectedIds.has(comment.id)}
          onSelectedChange={(selected) => selection.toggle(comment.id, selected)}
        />
      ))}
    </section>
  );
}
