import { runDiffResponseSchema, type RunDiffResponse } from "@otomat/domain";

import type { RunDiffResult } from "#review";

/** Maps a `RunDiffResult` to its wire contract, remapping camelCase fields to snake_case; `diff` is null when the result carries no computed diff. */
export function toRunDiffResponse(runId: string, result: RunDiffResult): RunDiffResponse {
  const diff = result.diff;
  return runDiffResponseSchema.parse({
    run_id: runId,
    computed_at: result.computedAt,
    diff: diff
      ? {
          base: diff.base,
          additions: diff.additions,
          deletions: diff.deletions,
          sha: diff.sha,
          files: diff.files.map((file) => ({
            path: file.path,
            old_path: file.oldPath,
            status: file.status,
            additions: file.additions,
            deletions: file.deletions,
            binary: file.binary,
            patch: file.patch,
            sha: file.sha,
          })),
        }
      : null,
  });
}
