import type { ReviewCommentContract } from "@otomat/domain";
import { Checkbox, Chip, ReviewCommentStatusChip } from "@otomat/ui";
import { commentAnchorLabel, reviewCommentDomId } from "@web/components/runs/review/comment/anchor";
import { CommentSnapshot } from "@web/components/runs/review/comment/snapshot";

export interface ReviewCommentCardProps {
  comment: ReviewCommentContract;
  /** Set when the comment is shown away from its anchor; states why and shows its pinned excerpt. */
  fallbackReason?: string;
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
}

export function ReviewCommentCard({
  comment,
  fallbackReason,
  selected = false,
  onSelectedChange,
}: ReviewCommentCardProps) {
  const selectable = comment.status === "open" && onSelectedChange !== undefined;
  const fixPending = comment.status === "open" && comment.fix_requested_at !== null;

  return (
    <div
      id={reviewCommentDomId(comment.id)}
      className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-3"
    >
      <div className="flex items-center gap-2">
        {selectable ? (
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelectedChange(checked === true)}
            aria-label={`Select comment on ${commentAnchorLabel(comment)} for fix`}
          />
        ) : null}
        <span className="min-w-0 truncate font-mono text-xs text-text-tertiary">
          {commentAnchorLabel(comment)}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          {fixPending ? <Chip tone="iris">Fix requested</Chip> : null}
          <ReviewCommentStatusChip status={comment.status} />
        </span>
      </div>
      <p className="whitespace-pre-wrap text-sm">{comment.body}</p>
      {fallbackReason === undefined ? null : (
        <>
          <p className="text-xs text-text-tertiary">{fallbackReason}</p>
          <CommentSnapshot snapshot={comment.hunk_snapshot} />
        </>
      )}
    </div>
  );
}
