import type { DiffFileContract } from "@otomat/domain";
import { groupDiffFiles } from "@web/components/runs/diff/files/group";
import type { DiffGroupingMode, DiffSortMode } from "@web/components/runs/diff/prefs/prefs";

export interface HideReviewedOptions {
  hideReviewed: boolean;
  reviewedPaths: ReadonlySet<string>;
  commentedPaths: ReadonlySet<string>;
  activePath: string | null;
}

export interface VisibleFiles {
  files: DiffFileContract[];
  hiddenCount: number;
}

function changeCount(file: DiffFileContract): number {
  return file.additions + file.deletions;
}

function sortDiffFiles(files: readonly DiffFileContract[], sort: DiffSortMode): DiffFileContract[] {
  if (sort === "changes") {
    return files.toSorted((left, right) => changeCount(right) - changeCount(left));
  }
  return files.toSorted((left, right) => left.path.localeCompare(right.path));
}

export function orderDiffFiles(
  files: readonly DiffFileContract[],
  sort: DiffSortMode,
  grouping: DiffGroupingMode,
): DiffFileContract[] {
  const sorted = sortDiffFiles(files, sort);
  if (grouping === "none") return sorted;
  return groupDiffFiles(sorted).flatMap((group) => group.files);
}

export function hideReviewedFiles(
  files: readonly DiffFileContract[],
  options: HideReviewedOptions,
): VisibleFiles {
  if (!options.hideReviewed) return { files: [...files], hiddenCount: 0 };
  const kept = files.filter(
    (file) =>
      !options.reviewedPaths.has(file.path) ||
      options.commentedPaths.has(file.path) ||
      file.path === options.activePath,
  );
  return { files: kept, hiddenCount: files.length - kept.length };
}
