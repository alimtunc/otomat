import type { PullRequestMergeMethod, PullRequestOverview } from "@otomat/domain";
import { Button, Icon } from "@otomat/ui";
import { useIsMutating } from "@tanstack/react-query";
import { useQueryKeys } from "@web/api/use-query-keys";
import { PullRequestMergeDialog } from "@web/components/pull-requests/overview/merge-dialog";
import { OverviewSection } from "@web/components/pull-requests/overview/section";
import { MERGE_METHOD_LABEL } from "@web/lib/pull-request/merge-method-label";
import { useState } from "react";

export function PullRequestMergePanel({ overview }: { overview: PullRequestOverview }) {
  const [method, setMethod] = useState<PullRequestMergeMethod | null>(null);
  const keys = useQueryKeys();
  // Read from the mutation cache, not an observer: the dialog that started the merge may be closed.
  const merging =
    useIsMutating({ mutationKey: keys.pullRequestMerge(overview.pull_request.id) }) > 0;
  const { merge } = overview;

  return (
    <OverviewSection title="Merge">
      <p className="mt-2 text-sm text-text-secondary">{merge.reason}</p>
      {overview.behind_base && merge.blocker !== "behind_base" ? (
        <p className="mt-1.5 text-xs text-text-tertiary">
          {overview.pull_request.head_ref} is behind {overview.pull_request.base_ref}.
        </p>
      ) : null}
      {merge.blocker === null ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {merge.methods.map((option) => (
            <Button
              key={option}
              size="sm"
              variant={option === "squash" ? "ghost" : "primary"}
              disabled={merging}
              onClick={() => setMethod(option)}
            >
              <Icon name="git-merge" aria-hidden />
              {MERGE_METHOD_LABEL[option]}
            </Button>
          ))}
        </div>
      ) : null}
      {method === null ? null : (
        <PullRequestMergeDialog
          overview={overview}
          method={method}
          onOpenChange={(open) => {
            if (!open) setMethod(null);
          }}
        />
      )}
    </OverviewSection>
  );
}
