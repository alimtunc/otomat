import type { PullRequestChecksState, PullRequestReviewDecision } from "@otomat/domain";
import type { StatusTone } from "@otomat/ui";

interface InboxSignal {
  label: string;
  tone: StatusTone;
}

/** What GitHub answered about the head's checks; `none` is "no check ran", never "they passed". */
export const CHECKS_SIGNAL: Record<PullRequestChecksState, InboxSignal> = {
  passing: { label: "Checks passing", tone: "success" },
  failing: { label: "Checks failing", tone: "danger" },
  pending: { label: "Checks running", tone: "warning" },
  none: { label: "No checks", tone: "neutral" },
};

export const REVIEW_DECISION_SIGNAL: Record<PullRequestReviewDecision, InboxSignal> = {
  approved: { label: "Approved", tone: "success" },
  changes_requested: { label: "Changes requested", tone: "warning" },
  review_required: { label: "Review required", tone: "review" },
};
