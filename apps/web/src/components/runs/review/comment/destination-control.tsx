import { isReviewCommentDestination, type ReviewCommentDestination } from "@otomat/domain";
import { Icon, SegmentedControl, SegmentedItem } from "@otomat/ui";

export interface CommentDestinationControlProps {
  destination: ReviewCommentDestination;
  onChange: (destination: ReviewCommentDestination) => void;
  /** Why PR review is out of reach; the choice stays visible and explained instead of hidden. */
  unavailableReason: string | null;
  fellBack: boolean;
}

function describeDestination(
  destination: ReviewCommentDestination,
  unavailableReason: string | null,
  fellBack: boolean,
): string {
  if (unavailableReason !== null) {
    return `${fellBack ? "Falling back to Agent: " : ""}${unavailableReason}`;
  }
  return destination === "agent"
    ? "Stays in Otomat, where Fix selected comments with AI can pick it up."
    : "Posts on the GitHub pull request and is never sent to the agent.";
}

export function CommentDestinationControl({
  destination,
  onChange,
  unavailableReason,
  fellBack,
}: CommentDestinationControlProps) {
  return (
    <div className="flex flex-col gap-1">
      <SegmentedControl
        type="single"
        value={destination}
        onValueChange={(value) => {
          if (isReviewCommentDestination(value)) onChange(value);
        }}
        aria-label="Comment destination"
      >
        <SegmentedItem value="agent" icon={<Icon name="bot" />}>
          Agent
        </SegmentedItem>
        <SegmentedItem
          value="pr_review"
          icon={<Icon name="git-pull-request" />}
          disabled={unavailableReason !== null}
        >
          PR review
        </SegmentedItem>
      </SegmentedControl>
      <p className="text-xs text-text-tertiary">
        {describeDestination(destination, unavailableReason, fellBack)}
      </p>
    </div>
  );
}
