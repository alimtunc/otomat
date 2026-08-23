import type { ReviewCommentContract } from "@otomat/domain";
import { Button, StatusChip } from "@otomat/ui";

export interface CommentPublicationProps {
  comment: ReviewCommentContract;
  onPublish?: () => void;
  publishing: boolean;
}

export function CommentPublication({ comment, onPublish, publishing }: CommentPublicationProps) {
  const retryable =
    comment.publication_status === "local" || comment.publication_status === "failed";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <StatusChip kind="reviewCommentPublication" status={comment.publication_status} />
        {comment.external_url === null ? null : (
          <a
            href={comment.external_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-iris-text underline underline-offset-2"
          >
            View on GitHub
          </a>
        )}
        {retryable && onPublish !== undefined ? (
          <Button
            variant="outline"
            size="xs"
            className="ml-auto"
            loading={publishing}
            onClick={onPublish}
          >
            {comment.publication_status === "failed" ? "Retry publish" : "Publish to GitHub"}
          </Button>
        ) : null}
      </div>
      {comment.publication_error === null ? null : (
        <p role="alert" className="text-xs text-danger">
          {comment.publication_error}
        </p>
      )}
    </div>
  );
}
