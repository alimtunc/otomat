import type { LinearCommentContract } from "@otomat/domain";
import { Avatar, Button, Markdown, RelativeTime } from "@otomat/ui";

export function Card({
  comment,
  onReply,
}: {
  comment: LinearCommentContract;
  onReply?: () => void;
}) {
  const author = comment.author_name ?? "Unknown";
  return (
    <article className="rounded-lg border border-border-subtle bg-surface-1 px-3 py-2.5">
      <header className="flex items-center gap-2 text-xs">
        <Avatar name={author} size="sm" />
        <span className="font-medium text-foreground">{author}</span>
        <span className="text-text-tertiary">
          <RelativeTime date={comment.created_at} />
        </span>
        <span className="flex-1" />
        {onReply ? (
          <Button size="xs" variant="ghost" onClick={onReply}>
            Reply
          </Button>
        ) : null}
      </header>
      <Markdown value={comment.body} className="mt-1.5 text-sm text-foreground" allowMedia />
    </article>
  );
}
