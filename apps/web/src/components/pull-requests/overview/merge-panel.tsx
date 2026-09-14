import type { PullRequestCheck, PullRequestMergeMethod, PullRequestOverview } from "@otomat/domain";
import { Button, Chip, Icon } from "@otomat/ui";
import { useIsMutating } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useQueryKeys } from "@web/api/use-query-keys";
import { PullRequestMergeDialog } from "@web/components/pull-requests/overview/merge-dialog";
import { SubmitPullRequestReview } from "@web/components/pull-requests/submit-review";
import { reviewDecisionSignal } from "@web/lib/pull-request/inbox/signals";
import { MERGE_METHOD_LABEL } from "@web/lib/pull-request/merge-method-label";
import { useState } from "react";

function countChecks(checks: PullRequestCheck[], state: PullRequestCheck["state"]): number {
  return checks.filter((check) => check.state === state).length;
}

export function PullRequestMergePanel({ overview }: { overview: PullRequestOverview }) {
  const [method, setMethod] = useState<PullRequestMergeMethod | null>(null);
  const keys = useQueryKeys();
  // Read from the mutation cache, not an observer: the dialog that started the merge may be closed.
  const merging =
    useIsMutating({ mutationKey: keys.pullRequestMerge(overview.pull_request.id) }) > 0;
  const { merge, pull_request: pullRequest, checks } = overview;
  const decision =
    reviewDecisionSignal(pullRequest.review_decision)?.label ?? "Review decision not reported";

  return (
    <section
      aria-label="Merge decision"
      className="rounded-lg border border-border-subtle bg-surface-1 p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={merge.blocker === null ? "review" : "warning"}>
          {merge.blocker === null ? "Ready to merge" : "Merge blocked"}
        </Chip>
        <p className="text-sm text-text-secondary">{merge.reason}</p>
      </div>
      <dl className="my-3 grid grid-cols-3 gap-3 text-xs text-text-secondary">
        <div>
          <dt className="mb-1 text-text-tertiary">Checks</dt>
          <dd>
            {countChecks(checks, "pending")} running · {countChecks(checks, "passing")} passing ·{" "}
            {countChecks(checks, "failing")} failing
          </dd>
        </div>
        <div>
          <dt className="mb-1 text-text-tertiary">Review</dt>
          <dd>
            {decision} ·{" "}
            {pullRequest.requested_reviewers.length === 0
              ? "no reviewer assigned"
              : pullRequest.requested_reviewers.map((reviewer) => reviewer.handle).join(", ")}
          </dd>
        </div>
        <div>
          <dt className="mb-1 text-text-tertiary">Base</dt>
          <dd>
            {pullRequest.base_ref ?? "unknown"} · {overview.behind_base ? "behind" : "up to date"}
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={
            <Link
              to="/pull-requests/$pullRequestId/diff"
              params={{ pullRequestId: pullRequest.id }}
            />
          }
        >
          <Icon name="git-compare" />
          Review diff
        </Button>
        <SubmitPullRequestReview pullRequestId={pullRequest.id} />
        {merge.blocker === null ? (
          <div className="ml-auto flex flex-wrap gap-2">
            {merge.methods.map((option) => (
              <Button
                key={option}
                size="sm"
                variant="outline"
                disabled={merging}
                onClick={() => setMethod(option)}
              >
                <Icon name="git-merge" aria-hidden />
                {MERGE_METHOD_LABEL[option]}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
      {method === null ? null : (
        <PullRequestMergeDialog
          overview={overview}
          method={method}
          onOpenChange={(open) => {
            if (!open) setMethod(null);
          }}
        />
      )}
    </section>
  );
}
