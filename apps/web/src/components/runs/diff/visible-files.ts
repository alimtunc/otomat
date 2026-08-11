import type { DiffFileContract } from "@otomat/domain";
import type { DiffSortMode } from "@web/components/runs/diff/prefs/prefs";

export interface HideReviewedOptions {
  hideReviewed: boolean;
  reviewedPaths: ReadonlySet<string>;
  /** Files carrying an unresolved comment stay on screen whatever `hideReviewed` says. */
  commentedPaths: ReadonlySet<string>;
}

export interface VisibleFiles {
  files: DiffFileContract[];
  hiddenCount: number;
}

function changeCount(file: DiffFileContract): number {
  return file.additions + file.deletions;
}

export function sortDiffFiles(
  files: readonly DiffFileContract[],
  sort: DiffSortMode,
): DiffFileContract[] {
  if (sort === "changes") {
    return files.toSorted((left, right) => changeCount(right) - changeCount(left));
  }
  return files.toSorted((left, right) => left.path.localeCompare(right.path));
}

export function hideReviewedFiles(
  files: readonly DiffFileContract[],
  options: HideReviewedOptions,
): VisibleFiles {
  if (!options.hideReviewed) return { files: [...files], hiddenCount: 0 };
  const kept = files.filter(
    (file) => !options.reviewedPaths.has(file.path) || options.commentedPaths.has(file.path),
  );
  return { files: kept, hiddenCount: files.length - kept.length };
}
