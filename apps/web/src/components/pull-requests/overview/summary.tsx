import type { PullRequestOverview } from "@otomat/domain";
import { Chip, PRStatusBadge, RelativeTime } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { REVIEW_DECISION_SIGNAL } from "@web/lib/pull-request/inbox/signals";

export function PullRequestOverviewSummary({ overview }: { overview: PullRequestOverview }) {
  const { pull_request: pullRequest, issue } = overview;
  const decision =
    pullRequest.review_decision === null
      ? null
      : REVIEW_DECISION_SIGNAL[pullRequest.review_decision];
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">{pullRequest.title}</h2>
        <PRStatusBadge status={pullRequest.status} />
        {decision === null ? null : <Chip tone={decision.tone}>{decision.label}</Chip>}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-tertiary">
        <span className="break-all font-mono">
          {pullRequest.head_ref ?? "unknown"} → {pullRequest.base_ref ?? "unknown"}
        </span>
        <span>
          ·{" "}
          {pullRequest.author_login === null
            ? "author not reported"
            : `@${pullRequest.author_login}`}
        </span>
        <span className="font-mono">
          · {overview.commits} commits · {overview.changed_files} files ·{" "}
          <span className="text-success">+{overview.additions}</span>{" "}
          <span className="text-danger">−{overview.deletions}</span>
        </span>
        <span>
          · updated{" "}
          {pullRequest.provider_updated_at === null ? (
            "not reported"
          ) : (
            <RelativeTime date={pullRequest.provider_updated_at} />
          )}
        </span>
        {issue === null ? null : (
          <Link
            to="/issues/$issueId"
            params={{ issueId: issue.id }}
            className="text-text-secondary underline"
          >
            Issue {issue.identifier ?? issue.title}
          </Link>
        )}
      </div>
    </section>
  );
}
