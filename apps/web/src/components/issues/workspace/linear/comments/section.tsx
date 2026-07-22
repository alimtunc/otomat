import { ErrorState, Skeleton } from "@otomat/ui";
import { useLinearComments } from "@web/api/linear/writeback";

import { Composer } from "./composer";
import { Thread } from "./thread";

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
    return roots.map((root) => (
      <Thread
        key={root.id}
        root={root}
        replies={comments.data.filter((comment) => comment.parent_id === root.id)}
        issueId={issueId}
        runId={runId}
      />
    ));
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
      <Composer
        issueId={issueId}
        runId={runId}
        parentId={null}
        placeholder="Comment on the Linear issue…"
      />
    </section>
  );
}
