import type { ReviewedFileContract } from "@otomat/domain";

/** An unsettled toggle outranks the last answer the daemon gave, so the control follows the click, not the round trip. */
export function reviewedPaths(
  marks: readonly ReviewedFileContract[],
  files: readonly { path: string; sha: string }[],
  unsettled: ReadonlyMap<string, boolean>,
): ReadonlySet<string> {
  const shaByPath = new Map(files.map((file) => [file.path, file.sha]));
  const reviewed = new Set<string>();
  for (const mark of marks) {
    if (mark.reviewed && shaByPath.get(mark.file_path) === mark.diff_sha) {
      reviewed.add(mark.file_path);
    }
  }
  for (const [path, intent] of unsettled) {
    if (!shaByPath.has(path)) continue;
    if (intent) reviewed.add(path);
    else reviewed.delete(path);
  }
  return reviewed;
}

export function unsyncedMarks(
  marks: readonly ReviewedFileContract[],
): ReadonlyMap<string, ReviewedFileContract> {
  return new Map(
    marks
      .filter((mark) => mark.sync_status === "failed" || mark.sync_status === "pending")
      .map((mark) => [mark.file_path, mark]),
  );
}
