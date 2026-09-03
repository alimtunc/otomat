import { isAgentFixEligible, type ReviewDetail, type ReviewTarget } from "@otomat/domain";
import { Chip } from "@otomat/ui";
import { ReviewFixStepDialog } from "@web/components/runs/review/fix-step-dialog";
import { SubmitReviewDialog } from "@web/components/runs/review/submit/dialog";

export interface DiffFixBarProps {
  target: ReviewTarget;
  workspaceOpen: boolean;
  issueId: string | null;
  review: ReviewDetail;
}

function ownedHint(workspaceOpen: boolean, count: number): string {
  if (!workspaceOpen) return "Fix is available while this issue’s workspace is still open.";
  if (count === 0) return "Address a comment to the agent to make it part of the next fix step.";
  return "A fix step freezes every open agent comment, its pinned hunk and the current diff as its context.";
}

export function DiffFixBar({ target, workspaceOpen, issueId, review }: DiffFixBarProps) {
  const count = review.comments.filter(isAgentFixEligible).length;
  const owned = review.fix_authority.kind === "otomat";
  const hint = owned ? ownedHint(workspaceOpen, count) : review.fix_authority.reason;
  const reviewable = target.kind === "run" && review.destinations.pr_review;

  return (
    <footer className="flex h-12 flex-none items-center gap-2.5 border-t border-border-subtle bg-surface-1 px-4.5">
      {owned ? null : (
        <Chip tone="neutral" hint={hint}>
          Review only
        </Chip>
      )}
      <span className="ml-auto flex items-center gap-2">
        {reviewable ? <SubmitReviewDialog target={target} detail={review} /> : null}
        {owned ? (
          <ReviewFixStepDialog
            runId={target.id}
            issueId={issueId}
            count={count}
            disabled={!workspaceOpen || count === 0}
            hint={hint}
          />
        ) : null}
      </span>
    </footer>
  );
}
