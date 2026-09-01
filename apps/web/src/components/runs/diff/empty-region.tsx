import type { ReviewCommentContract, ReviewTarget, RunDiffScope } from "@otomat/domain";
import { EmptyState } from "@otomat/ui";
import { diffScopeEmptyDescription } from "@web/components/runs/diff/scope/label";
import { DetachedComments } from "@web/components/runs/review/detached-comments";
import { CenteredState } from "@web/components/shell/centered-state";

export interface DiffEmptyRegionProps {
  target: ReviewTarget;
  scope: RunDiffScope;
  detached: ReviewCommentContract[];
  onPublish: (commentId: string) => void;
  publishingId: string | null;
}

export function DiffEmptyRegion({
  target,
  scope,
  detached,
  onPublish,
  publishingId,
}: DiffEmptyRegionProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <CenteredState fill="flex">
        <EmptyState
          icon="git-compare"
          title="No changes in this scope"
          description={diffScopeEmptyDescription(scope)}
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
