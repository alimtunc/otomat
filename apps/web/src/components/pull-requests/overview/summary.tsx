import type { PullRequestOverview } from "@otomat/domain";
import {
  Chip,
  Markdown,
  MetaList,
  PRStatusBadge,
  RelativeTime,
  type MetaListItem,
} from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { REVIEW_DECISION_SIGNAL } from "@web/lib/pull-request/inbox/signals";

function issueValue(overview: PullRequestOverview) {
  const { issue } = overview;
  if (issue === null) return <span className="text-text-tertiary">no issue resolved</span>;
  return (
    <Link to="/issues/$issueId" params={{ issueId: issue.id }} className="truncate">
      {issue.identifier === null ? issue.title : `${issue.identifier} · ${issue.title}`}
    </Link>
  );
}

export function PullRequestOverviewSummary({ overview }: { overview: PullRequestOverview }) {
  const pullRequest = overview.pull_request;
  const decision =
    pullRequest.review_decision === null
      ? null
      : REVIEW_DECISION_SIGNAL[pullRequest.review_decision];
  const items: MetaListItem[] = [
    {
      key: "repository",
      label: "Repository",
      value: (
        <span className="font-mono text-xs">{`${overview.repository}#${pullRequest.number ?? ""}`}</span>
      ),
    },
    {
      key: "branches",
      label: "Branches",
      value: (
        <span className="font-mono text-xs text-text-secondary">
          {pullRequest.head_ref ?? "unknown"} → {pullRequest.base_ref ?? "unknown"}
        </span>
      ),
    },
    { key: "issue", label: "Issue", value: issueValue(overview) },
    {
      key: "author",
      label: "Author",
      value: (
        <span className="text-text-secondary">
          {pullRequest.author_login === null ? "not reported" : `@${pullRequest.author_login}`}
        </span>
      ),
    },
    {
      key: "size",
      label: "Changes",
      value: (
        <span className="font-mono text-xs text-text-secondary">
          {overview.commits} commits · {overview.changed_files} files ·{" "}
          <span className="text-success">+{overview.additions}</span>{" "}
          <span className="text-danger">−{overview.deletions}</span>
        </span>
      ),
    },
    {
      key: "updated",
      label: "Updated",
      value:
        pullRequest.provider_updated_at === null ? (
          <span className="text-text-tertiary">not reported</span>
        ) : (
          <RelativeTime date={pullRequest.provider_updated_at} />
        ),
    },
  ];

  return (
    <section className="rounded-lg border border-border-subtle bg-surface-1 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">{pullRequest.title}</h2>
        <PRStatusBadge status={pullRequest.status} />
        {decision === null ? null : <Chip tone={decision.tone}>{decision.label}</Chip>}
      </div>
      <div className="mt-3.5">
        <MetaList items={items} />
      </div>
      <div className="mt-4 border-t border-border-subtle pt-4">
        {pullRequest.body === null ? (
          <p className="text-sm text-text-tertiary">This pull request has no description.</p>
        ) : (
          <Markdown value={pullRequest.body} />
        )}
      </div>
    </section>
  );
}
