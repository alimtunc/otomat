import type { ReviewCommentContract, ReviewDiffContract } from "@otomat/domain";
import { revealAndFocus } from "@web/components/runs/diff/diff-nav";
import { diffFileDomId } from "@web/components/runs/diff/files/card.utils";
import type { DiffSortMode } from "@web/components/runs/diff/prefs/prefs";
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

export interface DiffInteractionsInput {
  /** Keys the reviewed-file fingerprints and the active-file selection. */
  subjectId: string;
  diff: ReviewDiffContract;
  comments: ReviewCommentContract[];
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
  const collapsed = useCollapsedFiles();
  const reviewed = useReviewedFiles(input.subjectId, input.diff.files);
  const ordered = sortDiffFiles(input.diff.files, input.sort);
  const partition = partitionComments(input.diff, input.comments);
  const visible = hideReviewedFiles(ordered, {
    hideReviewed: input.hideReviewed,
    reviewedPaths: reviewed.paths,
    commentedPaths: partition.commentedPaths,
  });

  const revealFile = (path: string): void => {
    active.select(path);
    collapsed.set(path, false);
    const card = document.getElementById(diffFileDomId({ path }));
    if (card !== null) revealAndFocus(card, "start");
  };

  const toggleReviewed = (path: string, next: boolean): void => {
    reviewed.setReviewed(path, next);
    collapsed.set(path, next);
  };

  const selectComment = (comment: ReviewCommentContract): void => {
    if (partition.anchoredIds.has(comment.id)) {
      active.select(comment.file_path);
      collapsed.set(comment.file_path, false);
    }
    // The anchor only exists once the card it lives in has rendered expanded.
    requestAnimationFrame(() => {
      const anchor = document.getElementById(reviewCommentDomId(comment.id));
      if (anchor !== null) revealAndFocus(anchor, "center");
    });
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
