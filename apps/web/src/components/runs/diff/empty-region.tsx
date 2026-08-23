import type { ReviewCommentContract, ReviewTarget } from "@otomat/domain";
import { EmptyState } from "@otomat/ui";
import { DetachedComments } from "@web/components/runs/review/detached-comments";
import { CenteredState } from "@web/components/shell/centered-state";

export interface DiffEmptyRegionProps {
  target: ReviewTarget;
  detached: ReviewCommentContract[];
  onPublish: (commentId: string) => void;
  publishingId: string | null;
}

export function DiffEmptyRegion({
  target,
  detached,
  onPublish,
  publishingId,
}: DiffEmptyRegionProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <CenteredState fill="flex">
        <EmptyState
          icon="git-compare"
          title="No changes yet"
          description="The canonical git diff appears once a run produces changes. Diffs are never fabricated."
        />
      </CenteredState>
      <DetachedComments
        target={target}
        comments={detached}
        onPublish={onPublish}
        publishingId={publishingId}
      />
    </div>
  );
}
