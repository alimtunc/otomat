import type { ReviewState, RunDiffContract, RunState } from "@otomat/domain";
import { Button, Icon, ReviewStatusChip } from "@otomat/ui";
import { DiffSummary } from "@web/components/runs/diff/summary";
import type { ReviewSelection } from "@web/components/runs/review/use-selection";

export interface RunDiffHeaderProps {
  diff: RunDiffContract;
  reviewStatus: ReviewState | null;
  runStatus: RunState | undefined;
  selection: ReviewSelection;
}

export function RunDiffHeader({ diff, reviewStatus, runStatus, selection }: RunDiffHeaderProps) {
  const fixable =
    runStatus === "review_ready" && selection.selectedIds.size > 0 && !selection.isFixPending;
  const fixHint =
    runStatus === "review_ready"
      ? "Select open comments to send them to the agent."
      : "Fix is available once the run is review-ready.";

  return (
    <header className="flex flex-wrap items-center gap-3">
      {reviewStatus ? <ReviewStatusChip status={reviewStatus} /> : null}
      <DiffSummary diff={diff} />
      <span className="ml-auto flex items-center gap-2">
        <span className="text-xs text-text-tertiary">{fixHint}</span>
        <Button
          variant="primary"
          size="sm"
          disabled={!fixable}
          loading={selection.isFixPending}
          onClick={selection.submitFix}
        >
          <Icon name="wand-2" aria-hidden />
          Fix with AI ({selection.selectedIds.size})
        </Button>
      </span>
    </header>
  );
}
