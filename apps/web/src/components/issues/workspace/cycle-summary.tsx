import type { RunContract } from "@otomat/domain";
import { Button, ErrorState, ExternalLinkIconButton, Icon, Skeleton } from "@otomat/ui";
import { useRunPullRequest } from "@web/api/prs/queries";
import { useRunDetail } from "@web/api/runs/queries";
import { NextActionCtaButton } from "@web/components/runs/next-action/cta";
import { IconLink } from "@web/components/shell/icon-link";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { runNextAction } from "@web/lib/run/next-action";

export function CycleSummary({
  run,
  selectedStepId,
}: {
  run: RunContract;
  selectedStepId: string | null;
}) {
  const detail = useRunDetail(run.id);
  const pr = useRunPullRequest(run.id);
  return (
    <QueryBoundary
      query={detail}
      pending={<Skeleton height={32} />}
      error={
        <ErrorState
          variant="inline"
          title="Couldn’t load the cycle"
          onRetry={() => void detail.refetch()}
        />
      }
    >
      {(data) => {
        const action = runNextAction(data, pr.data);
        const pullRequest = pr.data?.pull_request;
        return (
          <section aria-label="Cycle summary" className="flex flex-wrap items-center gap-2">
            {action.cta ? (
              <NextActionCtaButton runId={run.id} cta={action.cta} size="sm" variant="primary" />
            ) : (
              <p className="text-xs text-text-secondary">{action.description}</p>
            )}
            {action.cta?.target.type === "diff" ? null : (
              <IconLink
                label="Review the run diff"
                icon={<Icon name="git-compare" aria-hidden />}
                to="/runs/$runId/diff"
                params={{ runId: run.id }}
                search={{ step: selectedStepId ?? undefined }}
              />
            )}
            {pullRequest?.url && action.cta?.target.type !== "external" ? (
              <ExternalLinkIconButton
                href={pullRequest.url}
                label={`Open PR #${pullRequest.number} on GitHub`}
              />
            ) : null}
            {pr.isError ? (
              <Button variant="ghost" size="xs" onClick={() => void pr.refetch()}>
                Couldn’t refresh publication state — retry
              </Button>
            ) : null}
          </section>
        );
      }}
    </QueryBoundary>
  );
}
