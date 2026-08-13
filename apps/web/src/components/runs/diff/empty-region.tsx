import type { ReviewCommentContract } from "@otomat/domain";
import { EmptyState } from "@otomat/ui";
import { DetachedComments } from "@web/components/runs/review/detached-comments";
import type { ReviewSelection } from "@web/components/runs/review/use-selection";
import { CenteredState } from "@web/components/shell/centered-state";

export interface DiffEmptyRegionProps {
  /** Comments survive an emptied diff, so they are shown here rather than lost with it. */
  detached: ReviewCommentContract[];
  selection: ReviewSelection;
  onPublish: (commentId: string) => void;
  publishingId: string | null;
}

export function DiffEmptyRegion({
  detached,
  selection,
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
      {detached.length === 0 ? null : (
        <div className="p-4">
          <DetachedComments
            comments={detached}
            selectedIds={selection.selectedIds}
            onToggle={selection.toggle}
            onPublish={onPublish}
            publishingId={publishingId}
          />
        </div>
      )}
    </div>
  );
}
