import type { ReviewedFileContract } from "@otomat/domain";

/** Defaults agree with `diffFile`'s sha, so a mark reads as current against the file it names. */
export function reviewedFile(
  overrides: Partial<ReviewedFileContract> & { file_path: string },
): ReviewedFileContract {
  return {
    id: `rf-${overrides.file_path}`,
    review_id: "rv1",
    diff_sha: `sha-${overrides.file_path}`,
    reviewed: true,
    sync_status: "local",
    sync_error: null,
    ...overrides,
  };
}
