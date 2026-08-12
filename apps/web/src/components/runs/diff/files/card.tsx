import type { DiffFileContract, ReviewCommentContract } from "@otomat/domain";
import { cn, FOCUS_RING } from "@otomat/ui";
import { DiffFileCardBody } from "@web/components/runs/diff/files/card-body";
import { DiffFileCardHeader } from "@web/components/runs/diff/files/card-header";
import { diffFileDomId, unrenderableNote } from "@web/components/runs/diff/files/card.utils";
import { useFileBlobs } from "@web/components/runs/diff/files/use-file-blobs";
import type { DiffPrefs } from "@web/components/runs/diff/prefs/prefs";
import { useNearViewport } from "@web/components/runs/diff/use-near-viewport";
import { ReviewCommentCard } from "@web/components/runs/review/comment/card";
import { ReviewCommentForm } from "@web/components/runs/review/comment/form";
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
  commentsByLine: Map<number, ReviewCommentContract[]>;
  fileComments: ReviewCommentContract[];
  onAddComment: (line: number | null, body: string) => Promise<void>;
  selectedCommentIds: ReadonlySet<string>;
  onToggleComment: (commentId: string, selected: boolean) => void;
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
  commentsByLine,
  fileComments,
  onAddComment,
  selectedCommentIds,
  onToggleComment,
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
      {fileComments.length === 0 ? null : (
        <div className="flex flex-col gap-2 border-b border-border bg-surface-1 p-3">
          {fileComments.map((comment) => (
            <ReviewCommentCard
              key={comment.id}
              comment={comment}
              selected={selectedCommentIds.has(comment.id)}
              onSelectedChange={(selected) => onToggleComment(comment.id, selected)}
            />
          ))}
        </div>
      )}
      {composing ? (
        <ReviewCommentForm
          filePath={file.path}
          line={null}
          onSubmit={(body) => onAddComment(null, body)}
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
          commentsByLine={commentsByLine}
          onAddComment={onAddComment}
          selectedCommentIds={selectedCommentIds}
          onToggleComment={onToggleComment}
        />
      )}
    </section>
  );
}
