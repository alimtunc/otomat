import type {
  DiffFileContract,
  ReviewCommentContract,
  ReviewDiffContract,
  ReviewedFileContract,
  ReviewTarget,
} from "@otomat/domain";
import { nextUnreviewedFile, revealAndFocus } from "@web/components/runs/diff/diff-nav";
import { diffFileDomId } from "@web/components/runs/diff/files/card.utils";
import type { DiffGroupingMode, DiffSortMode } from "@web/components/runs/diff/prefs/prefs";
import type { RevealBlock } from "@web/components/runs/diff/scroll";
import { useDiffSearch, type DiffSearch } from "@web/components/runs/diff/search/use-diff-search";
import { useSearchReveal } from "@web/components/runs/diff/search/use-search-reveal";
import { useActiveDiffFile, type ActiveDiffFile } from "@web/components/runs/diff/use-active-file";
import {
  useCollapsedFiles,
  type CollapsedFiles,
} from "@web/components/runs/diff/use-collapsed-files";
import { useDiffKeyboardNav } from "@web/components/runs/diff/use-diff-keyboard-nav";
import { useReviewedFiles, type ReviewedFiles } from "@web/components/runs/diff/use-reviewed-files";
import {
  hideReviewedFiles,
  orderDiffFiles,
  type VisibleFiles,
} from "@web/components/runs/diff/visible-files";
import { reviewCommentDomId } from "@web/components/runs/review/comment/anchor";
import { partitionComments, type PartitionedComments } from "@web/components/runs/review/partition";
import { useBackNavigation } from "@web/components/shell/use-back-navigation";
import { useLayoutEffect, useMemo, useState } from "react";

interface PendingReveal {
  domId: string;
  block: RevealBlock;
  /** The file the reveal selected: measuring before that selection renders reads the old layout. */
  selecting: string | null;
}

export interface DiffInteractionsInput {
  target: ReviewTarget;
  diff: ReviewDiffContract;
  comments: ReviewCommentContract[];
  reviewedFiles: ReviewedFileContract[];
  sort: DiffSortMode;
  grouping: DiffGroupingMode;
  hideReviewed: boolean;
}

export interface DiffInteractions {
  partition: PartitionedComments;
  ordered: DiffFileContract[];
  visible: VisibleFiles;
  reviewed: ReviewedFiles;
  active: ActiveDiffFile;
  collapsed: CollapsedFiles;
  search: DiffSearch;
  revealFile: (path: string) => void;
  toggleReviewed: (path: string, next: boolean) => void;
  selectComment: (comment: ReviewCommentContract) => void;
}

export function useDiffInteractions(input: DiffInteractionsInput): DiffInteractions {
  const back = useBackNavigation(null);
  const active = useActiveDiffFile();
  const reviewed = useReviewedFiles(input.target, input.reviewedFiles, input.diff.files);
  const collapsed = useCollapsedFiles(input.diff.files, reviewed.paths);
  const ordered = useMemo(
    () => orderDiffFiles(input.diff.files, input.sort, input.grouping),
    [input.diff.files, input.sort, input.grouping],
  );
  const partition = partitionComments(input.diff, input.comments);
  const visible = hideReviewedFiles(ordered, {
    hideReviewed: input.hideReviewed,
    reviewedPaths: reviewed.paths,
    commentedPaths: partition.commentedPaths,
    activePath: active.path,
  });
  const [revealing, setRevealing] = useState<PendingReveal | null>(null);
  const search = useDiffSearch(input.diff.files, ordered);

  const showFile = (path: string): void => {
    active.select(path);
    collapsed.set(path, false);
  };

  const revealFile = (path: string): void => {
    showFile(path);
    setRevealing({ domId: diffFileDomId({ path }), block: "start", selecting: path });
  };

  // Resolving nothing schedules no render, so the retry has to ride every later one.
  // otomat-allow-effect: scrolling to a card measures the DOM React has just committed.
  useLayoutEffect(() => {
    if (revealing === null) return;
    if (revealing.selecting !== null && active.path !== revealing.selecting) return;
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
    const anchored = partition.anchoredIds.has(comment.id);
    if (anchored) showFile(comment.file_path);
    setRevealing({
      domId: reviewCommentDomId(comment.id),
      block: "center",
      selecting: anchored ? comment.file_path : null,
    });
  };

  useSearchReveal(search, showFile);

  useDiffKeyboardNav({
    enabled: ordered.length > 0,
    files: visible.files,
    activePath: active.path,
    onJumpToFile: (file) => revealFile(file.path),
    onToggleReviewed: (path) => toggleReviewed(path, !reviewed.paths.has(path)),
    onExit: () => {
      if (search.query !== "") search.setQuery("");
      else back?.goBack();
    },
  });

  return {
    partition,
    ordered,
    visible,
    reviewed,
    active,
    collapsed,
    search,
    revealFile,
    toggleReviewed,
    selectComment,
  };
}
