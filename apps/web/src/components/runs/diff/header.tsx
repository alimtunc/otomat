import type { ReviewState, RunDiffContract } from "@otomat/domain";
import { ReviewStatusChip } from "@otomat/ui";
import { DiffSummary } from "@web/components/runs/diff/summary";

export interface RunDiffHeaderProps {
  diff: RunDiffContract;
  reviewStatus: ReviewState | null;
}

export function RunDiffHeader({ diff, reviewStatus }: RunDiffHeaderProps) {
  return (
    <header className="flex h-10.5 flex-none items-center gap-2.5 border-b border-border-subtle px-4.5">
      {reviewStatus ? <ReviewStatusChip status={reviewStatus} /> : null}
      <span className="ml-auto">
        <DiffSummary diff={diff} />
      </span>
    </header>
  );
}
