import type { PullRequestCheck, PullRequestReviewState } from "@otomat/domain";
import type { StatusTone } from "@otomat/ui";

interface OverviewSignal {
  label: string;
  tone: StatusTone;
}

export const REVIEW_STATE_SIGNAL = {
  approved: { label: "Approved", tone: "success" },
  changes_requested: { label: "Changes requested", tone: "warning" },
  commented: { label: "Commented", tone: "neutral" },
  dismissed: { label: "Dismissed", tone: "stale" },
  pending: { label: "Pending", tone: "review" },
} satisfies Record<PullRequestReviewState, OverviewSignal>;

export const CHECK_SIGNAL = {
  passing: { label: "Passing", tone: "success" },
  failing: { label: "Failing", tone: "danger" },
  pending: { label: "Running", tone: "warning" },
} satisfies Record<PullRequestCheck["state"], OverviewSignal>;
