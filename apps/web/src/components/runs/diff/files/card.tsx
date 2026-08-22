import type {
  DiffFileContract,
  ReviewedFileContract,
  ReviewTarget,
  RunDiffScopeSelector,
} from "@otomat/domain";
import { Button, cn, FOCUS_RING } from "@otomat/ui";
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

const NOTICE_CLASS = "flex items-center gap-2 border-b border-border px-3 py-2 text-xs";

export interface DiffFileCardProps {
  target: ReviewTarget;
  scope: RunDiffScopeSelector;
  file: DiffFileContract;
  prefs: DiffPrefs;
  reviewed: boolean;
  onReviewedChange: (reviewed: boolean) => void;
  unsyncedMark: ReviewedFileContract | null;
  onRetrySync: () => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  active: boolean;
  /** Reading inside the panel selects the file; observed, never intercepted. */
  onActivate: () => void;
  comments: DiffFileComments;
  commentActions: DiffFileCommentActions;
}

export function DiffFileCard({
  target,
  scope,
  file,
  prefs,
  reviewed,
  onReviewedChange,
  unsyncedMark,
  onRetrySync,
  collapsed,
  onCollapsedChange,
  active,
  onActivate,
  comments,
  commentActions,
}: DiffFileCardProps) {
  const viewport = useNearViewport();
  const blobs = useFileBlobs(target, file, scope);
  const [fullFile, setFullFile] = useState(false);
  const [composing, setComposing] = useState(false);
  const expandable = unrenderableNote(file) === null;

  const changeFullFile = (next: boolean): void => {
    if (next) blobs.request();
    setFullFile(next);
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
      className={cn("border-b border-border bg-surface-2", FOCUS_RING)}
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
        active={active}
        reviewed={reviewed}
        onReviewedChange={onReviewedChange}
        unsyncedMark={unsyncedMark}
        onRetrySync={onRetrySync}
        collapsed={collapsed}
        onCollapsedChange={onCollapsedChange}
        fullFile={fullFile}
        onFullFileChange={expandable ? changeFullFile : null}
        onCommentFile={commentOnFile}
      />
      {blobs.error === null ? null : (
        <p className={cn(NOTICE_CLASS, "text-danger")}>
          {blobs.error}
          <Button variant="ghost" size="xs" onClick={blobs.retry}>
            Retry
          </Button>
        </p>
      )}
      {blobs.isPending ? (
        <p className={cn(NOTICE_CLASS, "text-text-tertiary")}>Loading the full file…</p>
      ) : null}
      {comments.whole.length === 0 ? null : (
        <div className="flex flex-col gap-2 border-b border-border bg-surface-1 p-3">
          {comments.whole.map((comment) => (
            <ReviewCommentCard
              key={comment.id}
              target={target}
              comment={comment}
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
          target={target}
          file={file}
          mode={prefs.mode}
          wrap={prefs.wrap}
          highlight={viewport.near}
          context={blobs.context}
          fullFile={fullFile}
          comments={comments}
          commentActions={commentActions}
        />
      )}
    </section>
  );
}
