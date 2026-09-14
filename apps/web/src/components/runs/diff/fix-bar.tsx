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
  const owned = target.kind === "run" && review.fix_authority.kind === "otomat";
  const hint = owned ? ownedHint(workspaceOpen, count) : review.fix_authority.reason;
  const reviewable = target.kind === "pull_request" || review.destinations.pr_review;

  return (
    <span className="flex shrink-0 items-center gap-2">
      {owned || target.kind === "pull_request" ? null : (
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
    </span>
  );
}
