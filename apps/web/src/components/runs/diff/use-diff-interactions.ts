import type {
  ReviewCommentContract,
  ReviewDiffContract,
  ReviewedFileContract,
  ReviewTarget,
} from "@otomat/domain";
import { nextUnreviewedFile, revealAndFocus } from "@web/components/runs/diff/diff-nav";
import { diffFileDomId } from "@web/components/runs/diff/files/card.utils";
import type { DiffSortMode } from "@web/components/runs/diff/prefs/prefs";
import type { RevealBlock } from "@web/components/runs/diff/scroll";
import { useActiveDiffFile, type ActiveDiffFile } from "@web/components/runs/diff/use-active-file";
import {
  useCollapsedFiles,
  type CollapsedFiles,
} from "@web/components/runs/diff/use-collapsed-files";
import { useDiffKeyboardNav } from "@web/components/runs/diff/use-diff-keyboard-nav";
import { useReviewedFiles, type ReviewedFiles } from "@web/components/runs/diff/use-reviewed-files";
import {
  hideReviewedFiles,
  sortDiffFiles,
  type VisibleFiles,
} from "@web/components/runs/diff/visible-files";
import { reviewCommentDomId } from "@web/components/runs/review/comment/anchor";
import { partitionComments, type PartitionedComments } from "@web/components/runs/review/partition";
import { useBackNavigation } from "@web/components/shell/use-back-navigation";
import { useLayoutEffect, useState } from "react";

interface PendingReveal {
  domId: string;
  block: RevealBlock;
}

export interface DiffInteractionsInput {
  target: ReviewTarget;
  diff: ReviewDiffContract;
  comments: ReviewCommentContract[];
  reviewedFiles: ReviewedFileContract[];
  sort: DiffSortMode;
  hideReviewed: boolean;
}

export interface DiffInteractions {
  partition: PartitionedComments;
  visible: VisibleFiles;
  reviewed: ReviewedFiles;
  active: ActiveDiffFile;
  collapsed: CollapsedFiles;
  revealFile: (path: string) => void;
  toggleReviewed: (path: string, next: boolean) => void;
  selectComment: (comment: ReviewCommentContract) => void;
}

/** Everything a reviewer does to move through a loaded diff: select, reveal, collapse, mark, keyboard. */
export function useDiffInteractions(input: DiffInteractionsInput): DiffInteractions {
  const back = useBackNavigation(null);
  const active = useActiveDiffFile();
  const reviewed = useReviewedFiles(input.target, input.reviewedFiles, input.diff.files);
  const collapsed = useCollapsedFiles(input.diff.files, reviewed.paths);
  const ordered = sortDiffFiles(input.diff.files, input.sort);
  const partition = partitionComments(input.diff, input.comments);
  const visible = hideReviewedFiles(ordered, {
    hideReviewed: input.hideReviewed,
    reviewedPaths: reviewed.paths,
    commentedPaths: partition.commentedPaths,
    activePath: active.path,
  });
  const [revealing, setRevealing] = useState<PendingReveal | null>(null);

  const revealFile = (path: string): void => {
    active.select(path);
    collapsed.set(path, false);
    setRevealing({ domId: diffFileDomId({ path }), block: "start" });
  };

  // Resolving nothing schedules no render, so the retry has to ride every later one.
  // otomat-allow-effect: scrolling to a card measures the DOM React has just committed.
  useLayoutEffect(() => {
    if (revealing === null) return;
    const target = document.getElementById(revealing.domId);
    if (target === null) return;
    revealAndFocus(target, revealing.block);
    setRevealing(null);
  });

  const toggleReviewed = (path: string, next: boolean): void => {
    reviewed.setReviewed(path, next);
    collapsed.set(path, next);
    if (!next) return;
    const following = nextUnreviewedFile(visible.files, path, reviewed.paths);
    if (following !== null) revealFile(following.path);
  };

  const selectComment = (comment: ReviewCommentContract): void => {
    if (partition.anchoredIds.has(comment.id)) {
      active.select(comment.file_path);
      collapsed.set(comment.file_path, false);
    }
    setRevealing({ domId: reviewCommentDomId(comment.id), block: "center" });
  };

  useDiffKeyboardNav({
    enabled: ordered.length > 0,
    files: visible.files,
    activePath: active.path,
    onJumpToFile: (file) => revealFile(file.path),
    onToggleReviewed: (path) => toggleReviewed(path, !reviewed.paths.has(path)),
    onExit: () => back?.goBack(),
  });

  return {
    partition,
    visible,
    reviewed,
    active,
    collapsed,
    revealFile,
    toggleReviewed,
    selectComment,
  };
}
