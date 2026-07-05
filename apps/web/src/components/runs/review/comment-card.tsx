import type { ReviewCommentContract } from "@otomat/domain";
import { Checkbox, Chip, ReviewCommentStatusChip } from "@otomat/ui";

export interface ReviewCommentCardProps {
  comment: ReviewCommentContract;
  /** Render the file:line anchor + hunk snapshot — for comments detached from the live diff. */
  showSnapshot?: boolean;
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
}

export function ReviewCommentCard({
  comment,
  showSnapshot = false,
  selected = false,
  onSelectedChange,
}: ReviewCommentCardProps) {
  const selectable = comment.status === "open" && onSelectedChange !== undefined;
  const fixPending = comment.status === "open" && comment.fix_requested_at !== null;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-3">
      <div className="flex items-center gap-2">
        {selectable ? (
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelectedChange(checked === true)}
            aria-label={`Select comment on ${comment.file_path}:${comment.line} for fix`}
          />
        ) : null}
        <span className="min-w-0 truncate font-mono text-xs text-text-tertiary">
          {comment.file_path}:{comment.line}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          {fixPending ? <Chip tone="iris">Fix requested</Chip> : null}
          <ReviewCommentStatusChip status={comment.status} />
        </span>
      </div>
      <p className="whitespace-pre-wrap text-sm">{comment.body}</p>
      {showSnapshot && comment.hunk_snapshot !== "" ? (
        <pre className="overflow-x-auto rounded-sm border border-border-subtle bg-surface-1 p-2 font-mono text-xs text-text-secondary">
          {comment.hunk_snapshot}
        </pre>
      ) : null}
    </div>
  );
}
