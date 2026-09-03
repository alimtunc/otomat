import { shortSha, type ReviewDiffContract } from "@otomat/domain";
import { CopyButton } from "@otomat/ui";
import { DiffStat } from "@web/components/runs/diff/stat";

export function DiffSummary({ diff }: { diff: ReviewDiffContract }) {
  const fileCount = diff.files.length;
  const filesLabel = fileCount === 1 ? "1 file" : `${fileCount} files`;
  return (
    <span
      className="flex items-center gap-2 font-mono text-xs text-text-tertiary"
      title={`base ${shortSha(diff.base)} → head ${shortSha(diff.head)} · diff ${diff.sha}`}
    >
      <span>{filesLabel}</span>
      <DiffStat additions={diff.additions} deletions={diff.deletions} />
      <CopyButton value={diff.sha} label="Copy diff sha" />
    </span>
  );
}
