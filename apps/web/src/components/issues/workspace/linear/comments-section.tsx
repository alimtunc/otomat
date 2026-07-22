import type { LinearCommentContract } from "@otomat/domain";
import { Avatar, Button, ErrorState, RelativeTime, Skeleton, Textarea } from "@otomat/ui";
import { useLinearComments, usePublishLinearComment } from "@web/api/linear/writeback";
import { useState } from "react";

function CommentComposer({
  issueId,
  runId,
  parentId,
  placeholder,
  onPosted,
}: {
  issueId: string;
  runId: string | null;
  parentId: string | null;
  placeholder: string;
  onPosted?: () => void;
}) {
  const publish = usePublishLinearComment(issueId);
  const [body, setBody] = useState("");
  const [clientId, setClientId] = useState(() => crypto.randomUUID());

  return (
    <div className="flex flex-col gap-1.5">
      <Textarea
        rows={2}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="text-sm"
      />
      {body.trim().length > 0 ? (
        <Button
          size="xs"
          variant="primary"
          className="self-end"
          loading={publish.isPending}
          disabled={publish.isPending}
          onClick={() =>
            publish.mutate(
              { client_id: clientId, body: body.trim(), run_id: runId, parent_id: parentId },
              {
                onSuccess: () => {
                  setBody("");
                  setClientId(crypto.randomUUID());
                  onPosted?.();
                },
              },
            )
          }
        >
          {parentId === null ? "Comment" : "Post reply"}
        </Button>
      ) : null}
    </div>
  );
}

function CommentCard({
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
      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-[1.6] text-foreground">
        {comment.body}
      </p>
    </article>
  );
}

function Thread({
  root,
  replies,
  issueId,
  runId,
}: {
  root: LinearCommentContract;
  replies: LinearCommentContract[];
  issueId: string;
  runId: string | null;
}) {
  const [replying, setReplying] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <CommentCard comment={root} onReply={() => setReplying(true)} />
      {replies.length > 0 || replying ? (
        <div className="flex flex-col gap-2 border-l-2 border-border-subtle pl-3">
          {replies.map((reply) => (
            <CommentCard key={reply.id} comment={reply} />
          ))}
          {replying ? (
            <CommentComposer
              issueId={issueId}
              runId={runId}
              parentId={root.id}
              placeholder={`Reply to ${root.author_name ?? "this comment"}…`}
              onPosted={() => setReplying(false)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function LinearCommentsSection({
  issueId,
  runId,
}: {
  issueId: string;
  runId: string | null;
}) {
  const comments = useLinearComments(issueId);

  function threadArea() {
    if (comments.isPending) return <Skeleton height={72} />;
    if (comments.isError) {
      return (
        <ErrorState
          variant="inline"
          title="Connect to Linear to see comments"
          onRetry={() => void comments.refetch()}
        />
      );
    }
    const roots = comments.data.filter((comment) => comment.parent_id === null);
    return (
      <>
        {roots.map((root) => (
          <Thread
            key={root.id}
            root={root}
            replies={comments.data.filter((comment) => comment.parent_id === root.id)}
            issueId={issueId}
            runId={runId}
          />
        ))}
      </>
    );
  }

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
        Comments
        {comments.data !== undefined && comments.data.length > 0 ? (
          <span className="font-normal text-text-tertiary">· {comments.data.length}</span>
        ) : null}
      </div>
      {threadArea()}
      <CommentComposer
        issueId={issueId}
        runId={runId}
        parentId={null}
        placeholder="Comment on the Linear issue…"
      />
    </section>
  );
}
