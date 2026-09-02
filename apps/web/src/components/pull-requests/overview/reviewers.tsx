import type { PullRequestOverview } from "@otomat/domain";
import { Chip, RelativeTime } from "@otomat/ui";
import { REVIEW_STATE_SIGNAL } from "@web/lib/pull-request/overview-signals";

export function PullRequestReviewers({ overview }: { overview: PullRequestOverview }) {
  const requested = overview.pull_request.requested_reviewers;
  return (
    <section className="rounded-lg border border-border-subtle bg-surface-1 p-4">
      <h3 className="text-xs font-semibold text-text-secondary">Reviews</h3>
      {overview.reviews.length === 0 ? (
        <p className="mt-2 text-sm text-text-tertiary">Nobody has submitted a review yet.</p>
      ) : (
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {overview.reviews.map((review) => (
            <li
              key={`${review.author_login ?? "unknown"}-${review.state}`}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="truncate">
                {review.author_login === null ? "unknown reviewer" : `@${review.author_login}`}
              </span>
              <span className="inline-flex items-center gap-2">
                {review.submitted_at === null ? null : <RelativeTime date={review.submitted_at} />}
                <Chip tone={REVIEW_STATE_SIGNAL[review.state].tone}>
                  {REVIEW_STATE_SIGNAL[review.state].label}
                </Chip>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-text-tertiary">
        {requested.length === 0
          ? "No review is requested."
          : `Requested: ${requested.map((reviewer) => reviewer.handle).join(", ")}`}
      </p>
    </section>
  );
}
