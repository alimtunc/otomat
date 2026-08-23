import type { ReviewCommentContract, ReviewTarget } from "@otomat/domain";
import { Chip, ReviewCommentStatusChip } from "@otomat/ui";
import { commentAnchorLabel, reviewCommentDomId } from "@web/components/runs/review/comment/anchor";
import { CommentFixProof } from "@web/components/runs/review/comment/fix-proof";
import { CommentPublication } from "@web/components/runs/review/comment/publication";
import { CommentSnapshot } from "@web/components/runs/review/comment/snapshot";
import { CommentSuggestion } from "@web/components/runs/review/comment/suggestion";

export interface ReviewCommentCardProps {
  comment: ReviewCommentContract;
  target: ReviewTarget;
  fallbackReason?: string;
  onPublish?: () => void;
  publishing?: boolean;
}

export function ReviewCommentCard({
  comment,
  target,
  fallbackReason,
  onPublish,
  publishing = false,
}: ReviewCommentCardProps) {
  const fixPending = comment.status === "open" && comment.fix_requested_at !== null;

  return (
    <div
      id={reviewCommentDomId(comment.id)}
      className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-3"
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 truncate font-mono text-xs text-text-tertiary">
          {commentAnchorLabel(comment)}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          {fixPending ? <Chip tone="iris">Fix requested</Chip> : null}
          <Chip tone={comment.destination === "agent" ? "neutral" : "review"}>
            {comment.destination === "agent" ? "Agent" : "PR review"}
          </Chip>
          <ReviewCommentStatusChip status={comment.status} />
        </span>
      </div>
      {comment.body.trim() === "" ? null : (
        <p className="whitespace-pre-wrap text-sm">{comment.body}</p>
      )}
      {comment.suggestion === null ? null : (
        <CommentSuggestion
          original={comment.suggestion_original}
          replacement={comment.suggestion}
        />
      )}
      {comment.destination === "agent" ? null : (
        <CommentPublication comment={comment} onPublish={onPublish} publishing={publishing} />
      )}
      {fallbackReason === undefined ? null : (
        <>
          <p className="text-xs text-text-tertiary">{fallbackReason}</p>
          <CommentSnapshot snapshot={comment.hunk_snapshot} />
        </>
      )}
      {comment.status === "addressed" && target.kind === "run" ? (
        <CommentFixProof runId={target.id} commentId={comment.id} />
      ) : null}
    </div>
  );
}
