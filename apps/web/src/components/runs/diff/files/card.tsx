import type { DiffFileContract } from "@otomat/domain";
import { cn, FOCUS_RING } from "@otomat/ui";
import { DiffFileCardBody } from "@web/components/runs/diff/files/card-body";
import { DiffFileCardHeader } from "@web/components/runs/diff/files/card-header";
import { diffFileDomId, unrenderableNote } from "@web/components/runs/diff/files/card.utils";
import { DiffFileCommentIndicator } from "@web/components/runs/diff/files/comment-indicator";
import { useFileBlobs } from "@web/components/runs/diff/files/use-file-blobs";
import type { DiffPrefs } from "@web/components/runs/diff/prefs/prefs";
import { useNearViewport } from "@web/components/runs/diff/use-near-viewport";
import { ReviewCommentCard } from "@web/components/runs/review/comment/card";
import { ReviewCommentComposer } from "@web/components/runs/review/comment/composer";
import type {
  DiffFileCommentActions,
  DiffFileComments,
} from "@web/components/runs/review/file-comments";
import { useState } from "react";

export interface DiffFileCardProps {
  runId: string;
  file: DiffFileContract;
  prefs: DiffPrefs;
  reviewed: boolean;
  onReviewedChange: (reviewed: boolean) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  active: boolean;
  /** Reading inside the panel selects the file; observed, never intercepted. */
  onActivate: () => void;
  comments: DiffFileComments;
  commentActions: DiffFileCommentActions;
}

export function DiffFileCard({
  runId,
  file,
  prefs,
  reviewed,
  onReviewedChange,
  collapsed,
  onCollapsedChange,
  active,
  onActivate,
  comments,
  commentActions,
}: DiffFileCardProps) {
  const viewport = useNearViewport();
  const blobs = useFileBlobs(runId, file);
  const [expandAll, setExpandAll] = useState(false);
  const [composing, setComposing] = useState(false);
  const expandable = unrenderableNote(file) === null;

  const showFullFile = (): void => {
    blobs.request();
    setExpandAll(true);
  };
  const commentOnFile = (): void => {
    onCollapsedChange(false);
    setComposing(true);
  };

  return (
    <section
      ref={viewport.ref}
      id={diffFileDomId(file)}
      tabIndex={-1}
      aria-label={file.path}
      aria-current={active ? "true" : undefined}
      onPointerDownCapture={onActivate}
      onFocusCapture={onActivate}
      className={cn(
        "rounded-md border bg-surface-2",
        FOCUS_RING,
        active ? "border-border-strong" : "border-border",
      )}
    >
      <DiffFileCardHeader
        file={file}
        stats={prefs.stats}
        indicator={
          <DiffFileCommentIndicator
            filePath={file.path}
            counts={comments.counts}
            comments={comments.all}
            anchoredIds={comments.anchoredIds}
            onSelect={commentActions.reveal}
          />
        }
        reviewed={reviewed}
        onReviewedChange={onReviewedChange}
        collapsed={collapsed}
        onCollapsedChange={onCollapsedChange}
        onExpandContext={expandable && !blobs.requested ? blobs.request : null}
        onShowFullFile={expandable ? showFullFile : null}
        onCommentFile={commentOnFile}
      />
      {blobs.error === null ? null : (
        <p className="border-b border-border px-3 py-2 text-xs text-danger">{blobs.error}</p>
      )}
      {blobs.isPending ? (
        <p className="border-b border-border px-3 py-2 text-xs text-text-tertiary">
          Loading the file around this patch…
        </p>
      ) : null}
      {comments.whole.length === 0 ? null : (
        <div className="flex flex-col gap-2 border-b border-border bg-surface-1 p-3">
          {comments.whole.map((comment) => (
            <ReviewCommentCard
              key={comment.id}
              comment={comment}
              selected={comments.selectedIds.has(comment.id)}
              onSelectedChange={(selected) => commentActions.toggle(comment.id, selected)}
              onPublish={() => commentActions.publish(comment.id)}
              publishing={comments.publishingId === comment.id}
            />
          ))}
        </div>
      )}
      {composing ? (
        <ReviewCommentComposer
          file={file}
          side="new"
          line={null}
          fromLine={null}
          destinations={comments.destinations}
          preferredDestination={comments.preferredDestination}
          onSubmit={(comment) => commentActions.add(file, comment)}
          onClose={() => setComposing(false)}
        />
      ) : null}
      {collapsed ? null : (
        <DiffFileCardBody
          file={file}
          mode={prefs.mode}
          wrap={prefs.wrap}
          highlight={viewport.near}
          context={blobs.context}
          expandAll={expandAll}
          comments={comments}
          commentActions={commentActions}
        />
      )}
    </section>
  );
}
