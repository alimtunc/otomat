import type { RunDiffContract } from "@otomat/domain";
import { CopyButton } from "@otomat/ui";
import { DiffStat } from "@web/components/runs/diff/stat";

/** The diff header's summary line: file count, aggregate +/- counts, and the short, copyable diff sha. */
export function DiffSummary({ diff }: { diff: RunDiffContract }) {
  const fileCount = diff.files.length;
  const filesLabel = fileCount === 1 ? "1 file" : `${fileCount} files`;
  return (
    <span className="flex items-center gap-2 font-mono text-xs text-text-tertiary">
      <span>{filesLabel}</span>
      <DiffStat additions={diff.additions} deletions={diff.deletions} />
      <span className="flex items-center gap-1" title={diff.sha}>
        diff {diff.sha.slice(0, 10)}
        <CopyButton value={diff.sha} label="Copy diff sha" />
      </span>
    </span>
  );
}
