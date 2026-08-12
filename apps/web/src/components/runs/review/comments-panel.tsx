import type { ReviewCommentContract } from "@otomat/domain";
import { Button, cn, Pill, PillTabs, resolveStatus, ReviewCommentStatusChip } from "@otomat/ui";
import { commentAnchorLabel } from "@web/components/runs/review/comment/anchor";
import {
  filterReviewComments,
  isReviewCommentFilter,
  REVIEW_COMMENT_FILTERS,
  type ReviewCommentFilter,
} from "@web/components/runs/review/comment/filter";
import { useState } from "react";

export interface ReviewCommentsPanelProps {
  comments: ReviewCommentContract[];
  anchoredIds: ReadonlySet<string>;
  activeCommentId: string | null;
  onSelect: (comment: ReviewCommentContract) => void;
}

export function ReviewCommentsPanel({
  comments,
  anchoredIds,
  activeCommentId,
  onSelect,
}: ReviewCommentsPanelProps) {
  const [filter, setFilter] = useState<ReviewCommentFilter>("all");
  const shown = filterReviewComments(comments, filter);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-2 py-1.5">
        <PillTabs
          type="single"
          value={filter}
          onValueChange={(value) => {
            if (isReviewCommentFilter(value)) setFilter(value);
          }}
          aria-label="Comment state"
        >
          {REVIEW_COMMENT_FILTERS.map((option) => (
            <Pill key={option} value={option} className="text-[11px]">
              {option === "all" ? "All" : resolveStatus("reviewComment", option).label}
            </Pill>
          ))}
        </PillTabs>
      </div>
      {shown.length === 0 ? (
        <p className="px-3 py-2 text-xs text-text-tertiary">No comment in this state.</p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-auto pb-2">
          {shown.map((comment) => (
            <li key={comment.id}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                title={commentAnchorLabel(comment)}
                aria-current={comment.id === activeCommentId ? "true" : undefined}
                onClick={() => onSelect(comment)}
                className={cn(
                  "h-auto w-full flex-col items-start gap-1 rounded-none px-3 py-2 text-xs font-normal text-text-secondary hover:bg-hover",
                  comment.id === activeCommentId && "bg-selected text-foreground",
                )}
              >
                <span className="flex w-full items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate text-left font-mono text-[11px]">
                    {commentAnchorLabel(comment)}
                  </span>
                  <ReviewCommentStatusChip status={comment.status} />
                </span>
                <span className="w-full truncate text-left">{comment.body}</span>
                {anchoredIds.has(comment.id) ? null : (
                  <span className="text-[10px] text-text-tertiary">Shown at its fallback</span>
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
