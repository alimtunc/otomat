import type { ReviewCommentContract } from "@otomat/domain";
import {
  Button,
  cn,
  Icon,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ReviewCommentStatusChip,
} from "@otomat/ui";
import { commentAnchorLabel } from "@web/components/runs/review/comment/anchor";
import {
  describeFileComments,
  type FileCommentCounts,
} from "@web/components/runs/review/file-comment-counts";
import { useState } from "react";

export interface DiffFileCommentIndicatorProps {
  filePath: string;
  counts: FileCommentCounts;
  comments: readonly ReviewCommentContract[];
  anchoredIds: ReadonlySet<string>;
  onSelect: (comment: ReviewCommentContract) => void;
}

export function DiffFileCommentIndicator({
  filePath,
  counts,
  comments,
  anchoredIds,
  onSelect,
}: DiffFileCommentIndicatorProps) {
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const total = counts.open + counts.addressed;
  if (total === 0) return null;

  const reveal = (comment: ReviewCommentContract): void => {
    setRevealedId(comment.id);
    onSelect(comment);
  };
  const step = (by: 1 | -1): void => {
    const current = comments.findIndex((comment) => comment.id === revealedId);
    if (current === -1) {
      reveal(by === 1 ? comments[0] : comments[comments.length - 1]);
      return;
    }
    reveal(comments[(current + by + comments.length) % comments.length]);
  };
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            aria-label={describeFileComments(filePath, counts)}
            className={cn("gap-1 font-mono", counts.open === 0 && "text-text-tertiary")}
          >
            <Icon name="message-square" aria-hidden />
            {counts.open === 0 ? total : counts.open}
          </Button>
        }
      />
      <PopoverContent align="end" className="flex w-80 flex-col gap-1 p-1.5">
        <div className="flex items-center gap-1 px-1.5 py-1">
          <p className="min-w-0 flex-1 text-xs text-text-tertiary">
            {describeFileComments(filePath, counts)}
          </p>
          <Button
            variant="ghost"
            size="xs"
            aria-label={`Previous comment on ${filePath}`}
            onClick={() => step(-1)}
          >
            <Icon name="arrow-up" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="xs"
            aria-label={`Next comment on ${filePath}`}
            onClick={() => step(1)}
          >
            <Icon name="arrow-down" aria-hidden />
          </Button>
        </div>
        <ul className="flex max-h-64 flex-col overflow-auto">
          {comments.map((comment) => (
            <li key={comment.id}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => reveal(comment)}
                className="h-auto w-full flex-col items-start gap-1 rounded-sm px-1.5 py-1.5 text-xs font-normal text-text-secondary hover:bg-hover"
              >
                <span className="flex w-full items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate text-left font-mono text-micro">
                    {commentAnchorLabel(comment)}
                  </span>
                  <span className="text-micro uppercase tracking-wide text-text-tertiary">
                    {comment.destination === "agent" ? "Agent" : "PR"}
                  </span>
                  <ReviewCommentStatusChip status={comment.status} />
                </span>
                <span className="w-full truncate text-left">
                  {comment.body.trim() === "" ? "Code suggestion" : comment.body}
                </span>
                {comment.status !== "open" || anchoredIds.has(comment.id) ? null : (
                  <span className="text-micro text-stale">Stale — shown at its pinned excerpt</span>
                )}
              </Button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
